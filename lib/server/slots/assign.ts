// lib/server/slots/assign.ts
// Attribution manuelle de créneaux par un administrateur (fiche créneau, page
// Utilisateurs, matrice des participants) : un seul chemin serveur.
//
// Invariants :
//  - transaction : un créneau déjà pris (réservation en ligne, autre admin)
//    n'est jamais écrasé ; rien n'est écrit si un seul contrôle échoue ;
//  - catégorie à plusieurs (Pizza Due) : TOUS les équipiers saisis dès
//    l'attribution → une équipe, un créneau, un dossard d'équipe distinct ;
//  - aucun statut « payé » inventé : « payé » exige un paiement réel de
//    l'acheteur dans la même édition, auquel le créneau est rattaché ;
//  - identités : participant existant choisi par son identifiant, ou nouvelle
//    fiche (réutilisée seulement pour une saisie strictement identique du même
//    acheteur) — jamais de rapprochement sur une ressemblance ;
//  - idempotent : un `requestId` rejoué (double clic, reprise) ne crée rien de plus.

import { FieldValue, Timestamp, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
import { canonicalName, displayName, isNameComplete, looseNameKey, normalizeSpaces, strictNameKey } from "@/lib/domain/names";
import { getParticipantsPerSlot } from "@/lib/booking/rules";
import { toDateOrNull } from "@/lib/domain/event-lifecycle";
import { ParticipantActionError, type ActionContext } from "@/lib/server/participants/service";

export interface AssignedPerson {
  /** Participant existant de l'édition (prioritaire sur le nom saisi). */
  participantId?: string;
  firstName?: string;
  lastName?: string;
  shirtSize?: string;
  email?: string;
  phone?: string;
}

export interface ManualAssignmentInput {
  eventId: string;
  requestId: string;
  /** Compte responsable (acheteur) ; facultatif pour un créneau offert. */
  buyerId: string | null;
  status: "offered" | "paid";
  /** Obligatoire pour « payé » : paiement réel auquel rattacher le créneau. */
  paymentId?: string | null;
  /** `buyerId` par créneau : utile à la matrice (plusieurs concurrents en une fois). */
  assignments: Array<{ slotId: string; participants: AssignedPerson[]; allowIncomplete?: boolean; buyerId?: string | null }>;
}

export interface ManualAssignmentResult {
  requestId: string;
  created: boolean;
  slots: Array<{ slotId: string; participantIds: string[]; teamId: string | null }>;
}

/** Statuts d'édition où l'attribution manuelle reste possible. */
const ASSIGNABLE_EVENT_STATUSES = ["draft", "open", "closed"];

function overlaps(a: { start: Date | null; end: Date | null }, b: { start: Date | null; end: Date | null }) {
  if (!a.start || !b.start) return false;
  const aEnd = a.end ?? a.start;
  const bEnd = b.end ?? b.start;
  return a.start < bEnd && b.start < aEnd;
}

export async function assignSlotsManually(
  db: Firestore,
  input: ManualAssignmentInput,
  context: ActionContext
): Promise<ManualAssignmentResult> {
  if (!/^[\w-]{6,80}$/.test(input.requestId || "")) throw new ParticipantActionError(400, "Identifiant de requête invalide.", "invalid_request_id");
  if (!Array.isArray(input.assignments) || input.assignments.length === 0) throw new ParticipantActionError(400, "Aucun créneau à attribuer.", "empty");
  if (input.assignments.length > 100) throw new ParticipantActionError(400, "100 créneaux au plus par attribution.", "too_many");
  if (!["offered", "paid"].includes(input.status)) throw new ParticipantActionError(400, "Statut invalide.", "invalid_status");
  const slotIds = input.assignments.map(assignment => assignment.slotId);
  if (new Set(slotIds).size !== slotIds.length) throw new ParticipantActionError(400, "Un créneau apparaît deux fois.", "duplicate_slot");

  const requestRef = db.collection("manualAssignments").doc(input.requestId);
  const at = Timestamp.fromDate(context.now ?? new Date());

  return db.runTransaction(async tx => {
    // ───────────── Lectures ─────────────
    const previous = await tx.get(requestRef);
    if (previous.exists) return { ...(previous.data()!.result as ManualAssignmentResult), created: false };

    const event = await tx.get(db.collection("events").doc(input.eventId));
    if (!event.exists) throw new ParticipantActionError(404, "Édition introuvable.", "not_found");
    if (!ASSIGNABLE_EVENT_STATUSES.includes(event.data()!.status)) {
      throw new ParticipantActionError(409, "Édition terminée ou archivée : attribution impossible (correction historique à faire explicitement).", "event_locked");
    }

    let buyerId = input.buyerId || null;
    let payment: DocumentSnapshot | null = null;
    if (input.status === "paid") {
      if (!input.paymentId) throw new ParticipantActionError(400, "« Payé » exige de choisir le paiement réel de l'acheteur.", "payment_required");
      payment = await tx.get(db.collection("payments").doc(input.paymentId));
      const data = payment.data();
      if (!payment.exists || data?.eventId !== input.eventId || data?.status !== "paid") {
        throw new ParticipantActionError(409, "Paiement introuvable, non payé ou d'une autre édition.", "payment_invalid");
      }
      if (buyerId && data.userId !== buyerId) throw new ParticipantActionError(409, "Ce paiement appartient à un autre acheteur.", "payment_other_buyer");
      buyerId = data.userId;
    }
    const buyerOf = (index: number): string | null => {
      const own = input.assignments[index].buyerId;
      if (payment && own && own !== buyerId) throw new ParticipantActionError(409, "Ce paiement appartient à un autre acheteur.", "payment_other_buyer");
      return payment ? buyerId : own ?? buyerId;
    };
    const buyers = Array.from(new Set(input.assignments.map((_, index) => buyerOf(index)).filter(Boolean) as string[]));
    for (const id of buyers) {
      const buyer = await tx.get(db.collection("users").doc(id));
      if (!buyer.exists) throw new ParticipantActionError(404, "Compte acheteur introuvable.", "buyer_not_found");
    }

    const slots = await Promise.all(slotIds.map(id => tx.get(db.collection("slots").doc(id))));
    const categoryIds = Array.from(new Set(slots.map(slot => slot.data()?.categoryId as string).filter(Boolean)));
    const categories = new Map((await Promise.all(categoryIds.map(id => tx.get(db.collection("categories").doc(id))))).map(doc => [doc.id, doc]));
    const chosenIds = input.assignments.flatMap(assignment => assignment.participants.map(person => person.participantId).filter(Boolean) as string[]);
    // Saisie strictement identique d'une fiche du même acheteur : même identité (jamais sur ressemblance).
    const reuseByKey = new Map<string, string>();
    for (const id of buyers) {
      const owned = await tx.get(db.collection("participants").where("buyerIds", "array-contains", id));
      owned.docs.filter(doc => doc.data().eventId === input.eventId && !doc.data().withdrawn).forEach(doc => reuseByKey.set(`${id}|${doc.data().nameKey}`, doc.id));
    }
    const typedKeys = input.assignments.flatMap((assignment, index) =>
      assignment.participants
        .filter(person => !person.participantId && isNameComplete({ firstName: person.firstName ?? "", lastName: person.lastName ?? "" }))
        .map(person => `${buyerOf(index)}|${strictNameKey(canonicalName(person))}`)
    );
    const reusedIds = typedKeys.map(key => reuseByKey.get(key)).filter(Boolean) as string[];
    const existingIds = Array.from(new Set([...chosenIds, ...reusedIds]));
    const existingPeople = new Map((await Promise.all(existingIds.map(id => tx.get(db.collection("participants").doc(id))))).map(doc => [doc.id, doc]));
    const existingBookings = await Promise.all(existingIds.map(id => tx.get(db.collection("slots").where("participantIds", "array-contains", id))));

    // ───────────── Contrôles ─────────────
    const now = (context.now ?? new Date()).getTime();
    slots.forEach(slot => {
      const data = slot.data();
      const lockExpired = data?.status === "locked" && (toDateOrNull(data.lockedUntil)?.getTime() ?? 0) < now;
      if (!slot.exists || data?.eventId !== input.eventId) throw new ParticipantActionError(404, `Créneau ${slot.id} introuvable dans cette édition.`, "slot_not_found");
      if (!(data.status === "available" || lockExpired)) {
        throw new ParticipantActionError(409, `Créneau ${slot.id} déjà pris (${data.status}). Rien n'a été modifié.`, "slot_taken", { slotId: slot.id });
      }
      const category = categories.get(data.categoryId);
      if (!category?.exists || category.data()!.eventId !== input.eventId) {
        throw new ParticipantActionError(409, `Catégorie du créneau ${slot.id} invalide.`, "category_invalid");
      }
    });

    type Planned = { slot: DocumentSnapshot; categoryId: string; required: number; buyerId: string | null; members: Array<{ id: string; name: { firstName: string; lastName: string }; shirtSize?: string; email?: string; phone?: string; isNew: boolean }> };
    const planned: Planned[] = [];
    const newIds = new Map<string, string>();
    input.assignments.forEach((assignment, slotIndex) => {
      const slot = slots[slotIndex];
      const assignmentBuyer = buyerOf(slotIndex);
      const categoryId = slot.data()!.categoryId as string;
      const required = getParticipantsPerSlot(categories.get(categoryId)!.data());
      const people = assignment.participants.filter(person => person.participantId || isNameComplete({ firstName: person.firstName ?? "", lastName: person.lastName ?? "" }));
      const label = categories.get(categoryId)!.data()!.name ?? categoryId;
      if (people.length > required) throw new ParticipantActionError(400, `${label} : ${required} participant(s) au plus par créneau.`, "too_many_members");
      if (people.length === 0 || (people.length < required && !assignment.allowIncomplete)) {
        throw new ParticipantActionError(400, `${label} se dispute à ${required} : saisissez les ${required} équipiers (nom et prénom).`, "members_required", { slotId: slot.id, required });
      }
      const members = people.map((person, memberIndex) => {
        if (person.participantId) {
          const existing = existingPeople.get(person.participantId);
          const data = existing?.data();
          if (!existing?.exists || data?.eventId !== input.eventId) throw new ParticipantActionError(404, "Participant introuvable dans cette édition.", "participant_not_found");
          if (data.withdrawn) throw new ParticipantActionError(409, `${displayName(data as { firstName: string; lastName: string })} est retiré du planning.`, "participant_withdrawn");
          return { id: existing.id, name: { firstName: data.firstName, lastName: data.lastName }, shirtSize: data.shirtSize, isNew: false };
        }
        const name = canonicalName(person);
        const key = `${assignmentBuyer}|${strictNameKey(name)}`;
        const id = reuseByKey.get(key) ?? newIds.get(key) ?? `adm_${input.requestId}_${slotIndex}_${memberIndex}`;
        const isNew = !reuseByKey.has(key);
        if (isNew) newIds.set(key, id);
        return {
          id, name, isNew,
          shirtSize: person.shirtSize || undefined,
          email: normalizeSpaces(person.email) || undefined,
          phone: normalizeSpaces(person.phone) || undefined,
        };
      });
      if (new Set(members.map(member => member.id)).size !== members.length) {
        throw new ParticipantActionError(400, `${label} : une même personne ne peut occuper deux places du même créneau.`, "duplicate_member");
      }
      planned.push({ slot, categoryId, required, buyerId: assignmentBuyer, members });
    });

    // Une personne : une fois par catégorie, jamais deux passages simultanés
    // (dans cette attribution et avec ses créneaux existants).
    const bookingsOf = new Map<string, Array<{ categoryId: string; start: Date | null; end: Date | null; slotId: string }>>();
    existingIds.forEach((id, index) =>
      bookingsOf.set(id, existingBookings[index].docs.filter(doc => doc.data().status !== "available").map(doc => ({
        categoryId: doc.data().categoryId, start: toDateOrNull(doc.data().startTime), end: toDateOrNull(doc.data().endTime), slotId: doc.id,
      })))
    );
    for (const entry of planned) {
      const window = { start: toDateOrNull(entry.slot.data()!.startTime), end: toDateOrNull(entry.slot.data()!.endTime) };
      for (const member of entry.members) {
        const list = bookingsOf.get(member.id) ?? [];
        const clash = list.find(booking => booking.categoryId === entry.categoryId || overlaps(booking, window));
        if (clash) {
          throw new ParticipantActionError(
            409,
            `${displayName(member.name)} ${clash.categoryId === entry.categoryId ? "est déjà inscrit dans cette catégorie" : "a déjà un passage à cette heure"}.`,
            "participant_conflict",
            { participantId: member.id, slotId: clash.slotId }
          );
        }
        list.push({ categoryId: entry.categoryId, ...window, slotId: entry.slot.id });
        bookingsOf.set(member.id, list);
      }
    }

    // ───────────── Écritures ─────────────
    const created = new Set<string>();
    const result: ManualAssignmentResult = { requestId: input.requestId, created: true, slots: [] };
    for (const entry of planned) {
      for (const member of entry.members) {
        const ref = db.collection("participants").doc(member.id);
        if (member.isNew && !created.has(member.id)) {
          created.add(member.id);
          tx.create(ref, {
            eventId: input.eventId, ...member.name,
            enteredAs: { ...member.name }, nameKey: strictNameKey(member.name), looseNameKey: looseNameKey(member.name),
            ...(member.shirtSize ? { shirtSize: member.shirtSize } : {}),
            ...(member.email ? { email: member.email } : {}),
            ...(member.phone ? { phone: member.phone } : {}),
            bib: null, buyerIds: entry.buyerId ? [entry.buyerId] : [], createdFrom: "admin", sourcePaymentId: payment?.id ?? null,
            withdrawn: false, version: 1, createdAt: at, updatedAt: at, updatedBy: context.actor.uid,
          });
        } else if (!member.isNew && entry.buyerId) {
          tx.update(ref, { buyerIds: FieldValue.arrayUnion(entry.buyerId), updatedAt: at });
        }
      }
      const participantIds = entry.members.map(member => member.id);
      let teamId: string | null = null;
      if (entry.required > 1) {
        teamId = `adm_t_${input.requestId}_${entry.slot.id}`;
        tx.create(db.collection("teams").doc(teamId), {
          eventId: input.eventId, categoryId: entry.categoryId, slotId: entry.slot.id, memberIds: participantIds,
          requiredMembers: entry.required, status: participantIds.length >= entry.required ? "complete" : "incomplete",
          bib: null, displayName: null, buyerId: entry.buyerId, createdFrom: "admin", sourcePaymentId: payment?.id ?? null,
          version: 1, createdAt: at, updatedAt: at,
        });
      }
      const copies = entry.members.map(member => ({ ...member.name, ...(member.shirtSize ? { shirtSize: member.shirtSize } : {}) }));
      tx.update(entry.slot.ref, {
        status: input.status,
        buyerId: entry.buyerId,
        participantIds,
        teamId,
        participants: copies,
        participant: copies[0],
        assignmentType: "manual",
        assignedByAdminId: context.actor.uid,
        assignedAt: at,
        stripeSessionId: payment?.data()?.stripeSessionId ?? null,
        paymentId: payment?.id ?? null,
        ...(payment ? { paidAt: payment.data()?.createdAt ?? at } : {}),
        lockedByUserId: FieldValue.delete(),
        lockedUntil: FieldValue.delete(),
        pendingBookingId: FieldValue.delete(),
      });
      tx.set(db.collection("auditLogs").doc(), {
        eventId: input.eventId, entity: "slot", entityId: entry.slot.id, action: input.status === "paid" ? "slot.assign_to_payment" : "slot.offer",
        actorUid: context.actor.uid, actorName: context.actor.displayName, before: { status: entry.slot.data()!.status },
        after: { status: input.status, buyerId: entry.buyerId, participants: entry.members.map(member => displayName(member.name)), teamId, paymentId: payment?.id ?? null },
        reason: context.reason ?? null, at,
      });
      result.slots.push({ slotId: entry.slot.id, participantIds, teamId });
    }
    if (payment) {
      // Le créneau est rattaché au paiement réel (ex. réservation payée perdue) ; le montant ne change pas.
      tx.update(payment.ref, { slotIds: FieldValue.arrayUnion(...slotIds), updatedAt: at });
    }
    tx.create(requestRef, { eventId: input.eventId, requestedBy: context.actor.uid, result, createdAt: at });
    return result;
  });
}
