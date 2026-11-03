// lib/server/slots/transfer.ts
// Transfert d'une réservation vers un autre créneau (erreur de catégorie ou
// d'horaire). Tout suit dans une seule transaction : participants (copies et
// identités), équipe, acheteur, lien de paiement, statut. L'ancien créneau
// redevient vendable, sans aucune trace de l'ancienne réservation.
//
// Refusé : créneau cible déjà pris, édition terminée ou archivée, catégorie
// cible d'un autre format (individuel ↔ équipe), participant déjà inscrit dans
// la catégorie cible ou déjà en passage à cette heure.

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { getParticipantsPerSlot } from "@/lib/booking/rules";
import { toDateOrNull } from "@/lib/domain/event-lifecycle";
import { ParticipantActionError, type ActionContext } from "@/lib/server/participants/service";

const TRANSFERABLE_EVENT_STATUSES = ["draft", "open", "closed"];

function overlaps(a: { start: Date | null; end: Date | null }, b: { start: Date | null; end: Date | null }) {
  if (!a.start || !b.start) return false;
  return a.start < (b.end ?? b.start) && b.start < (a.end ?? a.start);
}

export interface TransferResult {
  sourceSlotId: string;
  targetSlotId: string;
  participantIds: string[];
  teamId: string | null;
  paymentIds: string[];
}

export async function transferSlotBooking(
  db: Firestore,
  input: { sourceSlotId: string; targetSlotId: string },
  context: ActionContext
): Promise<TransferResult> {
  if (!input.sourceSlotId || !input.targetSlotId || input.sourceSlotId === input.targetSlotId) {
    throw new ParticipantActionError(400, "Choisissez un créneau cible différent.", "invalid_target");
  }
  const at = Timestamp.fromDate(context.now ?? new Date());
  const sourceRef = db.collection("slots").doc(input.sourceSlotId);
  const targetRef = db.collection("slots").doc(input.targetSlotId);

  return db.runTransaction(async tx => {
    // ───────────── Lectures ─────────────
    const [source, target] = await Promise.all([tx.get(sourceRef), tx.get(targetRef)]);
    const from = source.data();
    const to = target.data();
    if (!source.exists || !target.exists || !from || !to) throw new ParticipantActionError(404, "Créneau introuvable.", "slot_not_found");
    if (from.eventId !== to.eventId) throw new ParticipantActionError(409, "Les deux créneaux doivent appartenir à la même édition.", "other_event");
    if (!["paid", "offered"].includes(from.status)) {
      throw new ParticipantActionError(409, "Le créneau d'origine n'a pas de réservation à transférer.", "source_not_booked");
    }
    const now = (context.now ?? new Date()).getTime();
    const lockExpired = to.status === "locked" && (toDateOrNull(to.lockedUntil)?.getTime() ?? 0) < now;
    if (!(to.status === "available" || lockExpired)) {
      throw new ParticipantActionError(409, "Le créneau cible vient d'être pris. Rien n'a été modifié.", "slot_taken");
    }

    const event = await tx.get(db.collection("events").doc(from.eventId));
    if (!TRANSFERABLE_EVENT_STATUSES.includes(event.data()?.status)) {
      throw new ParticipantActionError(409, "Édition terminée ou archivée : transfert impossible.", "event_locked");
    }
    const [fromCategory, toCategory] = await Promise.all([
      tx.get(db.collection("categories").doc(from.categoryId)),
      tx.get(db.collection("categories").doc(to.categoryId)),
    ]);
    if (getParticipantsPerSlot(fromCategory.data()) !== getParticipantsPerSlot(toCategory.data())) {
      throw new ParticipantActionError(
        409,
        "La catégorie cible n'a pas le même format (individuel / équipe) : libérez le créneau et attribuez-le avec les bons équipiers.",
        "team_size_mismatch"
      );
    }

    const participantIds: string[] = from.participantIds ?? [];
    const teamId: string | null = from.teamId ?? null;
    const team = teamId ? await tx.get(db.collection("teams").doc(teamId)) : null;
    const otherBookings = await Promise.all(
      participantIds.map(id => tx.get(db.collection("slots").where("participantIds", "array-contains", id)))
    );
    const payments = await tx.get(db.collection("payments").where("slotIds", "array-contains", source.id));

    // ───────────── Contrôles des participants ─────────────
    const window = { start: toDateOrNull(to.startTime), end: toDateOrNull(to.endTime) };
    otherBookings.forEach((bookings, index) => {
      const clash = bookings.docs.find(doc => {
        if (doc.id === source.id || doc.id === target.id || doc.data().status === "available") return false;
        return (
          doc.data().categoryId === to.categoryId ||
          overlaps({ start: toDateOrNull(doc.data().startTime), end: toDateOrNull(doc.data().endTime) }, window)
        );
      });
      if (clash) {
        const copy = (from.participants ?? [])[index];
        const label = copy ? `${copy.lastName ?? ""} ${copy.firstName ?? ""}`.trim() : participantIds[index];
        throw new ParticipantActionError(
          409,
          `${label} ${clash.data().categoryId === to.categoryId ? "est déjà inscrit dans la catégorie cible" : "a déjà un passage à cette heure"}.`,
          "participant_conflict",
          { participantId: participantIds[index], slotId: clash.id }
        );
      }
    });

    // ───────────── Écritures ─────────────
    tx.update(targetRef, {
      status: from.status,
      buyerId: from.buyerId ?? null,
      participant: from.participant ?? null,
      participants: from.participants ?? (from.participant ? [from.participant] : []),
      participantIds,
      teamId,
      stripeSessionId: from.stripeSessionId ?? null,
      paymentId: from.paymentId ?? null,
      paidAt: from.paidAt ?? null,
      assignmentType: from.assignmentType ?? "manual",
      ...(from.packId ? { packId: from.packId } : {}),
      assignedByAdminId: context.actor.uid,
      assignedAt: at,
      transferredFromSlotId: source.id,
      lockedByUserId: FieldValue.delete(),
      lockedUntil: FieldValue.delete(),
      pendingBookingId: FieldValue.delete(),
    });
    tx.update(sourceRef, {
      status: "available",
      participant: FieldValue.delete(),
      participants: FieldValue.delete(),
      participantIds: FieldValue.delete(),
      teamId: FieldValue.delete(),
      buyerId: FieldValue.delete(),
      lockedByUserId: FieldValue.delete(),
      lockedUntil: FieldValue.delete(),
      pendingBookingId: FieldValue.delete(),
      paidAt: FieldValue.delete(),
      paymentId: FieldValue.delete(),
      packId: FieldValue.delete(),
      assignmentType: FieldValue.delete(),
      assignedByAdminId: FieldValue.delete(),
      assignedAt: FieldValue.delete(),
      stripeSessionId: null,
      transferredToSlotId: target.id,
    });
    if (team?.exists) {
      tx.update(team.ref, { slotId: target.id, categoryId: to.categoryId, version: (team.data()!.version ?? 1) + 1, updatedAt: at });
    }
    // Le montant reste rattaché au créneau réellement disputé.
    payments.docs.forEach(payment =>
      tx.update(payment.ref, {
        slotIds: (payment.data().slotIds as string[]).map(id => (id === source.id ? target.id : id)),
        updatedAt: at,
      })
    );
    tx.set(db.collection("auditLogs").doc(), {
      eventId: from.eventId,
      entity: "slot",
      entityId: source.id,
      action: "slot.transfer",
      actorUid: context.actor.uid,
      actorName: context.actor.displayName,
      before: { slotId: source.id, categoryId: from.categoryId, date: from.date },
      after: { slotId: target.id, categoryId: to.categoryId, date: to.date, participantIds, teamId, payments: payments.docs.map(doc => doc.id) },
      reason: context.reason ?? null,
      at,
    });

    return { sourceSlotId: source.id, targetSlotId: target.id, participantIds, teamId, paymentIds: payments.docs.map(doc => doc.id) };
  });
}
