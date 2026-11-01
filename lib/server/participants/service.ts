// lib/server/participants/service.ts
// Actions administratives sur les identités sportives : correction de nom,
// dossard, équipiers, retrait. Toutes transactionnelles, versionnées et tracées.
//
// Ce qui n'est JAMAIS modifié ici : paiements, factures, données Stripe, profil
// du compte acheteur. Une correction sportive ne réécrit pas une pièce comptable.

import { Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { canonicalName, displayName, isNameComplete, looseNameKey, normalizeSpaces, strictNameKey } from "@/lib/domain/names";
import type { Actor } from "@/lib/server/auth";

export class ParticipantActionError extends Error {
  constructor(public status: number, message: string, public code: string, public details?: unknown) {
    super(message);
  }
}

export interface ActionContext {
  actor: Pick<Actor, "uid" | "displayName">;
  reason?: string | null;
  now?: Date;
}

function audit(
  tx: Transaction,
  db: Firestore,
  entry: { eventId?: string; entity: string; entityId: string; action: string; before: unknown; after: unknown },
  context: ActionContext,
  at: Timestamp
) {
  tx.set(db.collection("auditLogs").doc(), {
    ...entry,
    actorUid: context.actor.uid,
    actorName: context.actor.displayName,
    reason: normalizeSpaces(context.reason) || null,
    at,
  });
}

function assertVersion(current: number | undefined, expected: number | undefined) {
  if (expected === undefined) return;
  if ((current ?? 1) !== expected) {
    throw new ParticipantActionError(
      409,
      "Cette fiche a été modifiée entre-temps par quelqu'un d'autre. Rechargez-la avant de corriger.",
      "version_conflict",
      { currentVersion: current ?? 1 }
    );
  }
}

/* ────────────────────────────── Correction de nom ────────────────────────────── */

export interface RenameResult {
  participantId: string;
  version: number;
  before: { firstName: string; lastName: string };
  after: { firstName: string; lastName: string };
  updated: { slots: number; mealSeats: number; teams: number };
}

/**
 * Corrige le nom d'un participant et le reporte partout où il est affiché :
 * copies sur les créneaux (listes, programme, exports), places repas liées,
 * équipes. L'identifiant, les inscriptions, le dossard et les liens de paiement
 * sont conservés.
 */
export async function renameParticipant(
  db: Firestore,
  input: { participantId: string; firstName: string; lastName: string; expectedVersion?: number },
  context: ActionContext
): Promise<RenameResult> {
  const after = canonicalName({ firstName: input.firstName, lastName: input.lastName });
  if (!isNameComplete(after)) {
    throw new ParticipantActionError(400, "Le nom et le prénom sont obligatoires.", "name_required");
  }
  const at = Timestamp.fromDate(context.now ?? new Date());
  const ref = db.collection("participants").doc(input.participantId);

  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new ParticipantActionError(404, "Participant introuvable.", "not_found");
    const data = snapshot.data()!;
    assertVersion(data.version, input.expectedVersion);

    const [slots, seats, teams] = await Promise.all([
      tx.get(db.collection("slots").where("participantIds", "array-contains", ref.id)),
      tx.get(db.collection("mealSeats").where("beneficiaryParticipantId", "==", ref.id)),
      tx.get(db.collection("teams").where("memberIds", "array-contains", ref.id)),
    ]);

    const before = { firstName: data.firstName, lastName: data.lastName };
    const version = (data.version ?? 1) + 1;

    slots.docs.forEach(slot => {
      const slotData = slot.data();
      const ids: string[] = slotData.participantIds ?? [];
      const copies: Record<string, unknown>[] = Array.isArray(slotData.participants) ? [...slotData.participants] : [];
      ids.forEach((id, index) => {
        if (id === ref.id) copies[index] = { ...(copies[index] ?? {}), firstName: after.firstName, lastName: after.lastName };
      });
      tx.update(slot.ref, { participants: copies, participant: copies[0] ?? null });
    });
    seats.docs.forEach(seat => tx.update(seat.ref, { beneficiary: { ...after }, updatedAt: at }));
    teams.docs.forEach(team => tx.update(team.ref, { updatedAt: at }));

    tx.update(ref, {
      firstName: after.firstName,
      lastName: after.lastName,
      nameKey: strictNameKey(after),
      looseNameKey: looseNameKey(after),
      version,
      updatedAt: at,
      updatedBy: context.actor.uid,
    });
    audit(tx, db, { eventId: data.eventId, entity: "participant", entityId: ref.id, action: "participant.rename", before, after }, context, at);

    return {
      participantId: ref.id,
      version,
      before,
      after,
      updated: { slots: slots.size, mealSeats: seats.size, teams: teams.size },
    };
  });
}

/* ────────────────────────────── Dossards ────────────────────────────── */

/** Registre d'unicité : un document par numéro et par édition. */
export function bibRef(db: Firestore, eventId: string, bib: number) {
  return db.collection("bibs").doc(`${eventId}_${bib}`);
}

/**
 * Attribue (ou retire, avec `bib: null`) un dossard. Un numéro déjà porté est
 * refusé : il faut d'abord le retirer explicitement à son porteur (aucune
 * réattribution silencieuse).
 */
export async function assignBib(
  db: Firestore,
  input: { holderType: "participant" | "team"; holderId: string; bib: number | null; expectedVersion?: number },
  context: ActionContext
): Promise<{ bib: number | null; version: number }> {
  if (input.bib !== null && (!Number.isInteger(input.bib) || input.bib < 1 || input.bib > 9999)) {
    throw new ParticipantActionError(400, "Le dossard doit être un nombre entier entre 1 et 9999.", "invalid_bib");
  }
  const at = Timestamp.fromDate(context.now ?? new Date());
  const holderRef = db.collection(input.holderType === "team" ? "teams" : "participants").doc(input.holderId);

  return db.runTransaction(async tx => {
    const holder = await tx.get(holderRef);
    if (!holder.exists) throw new ParticipantActionError(404, "Fiche introuvable.", "not_found");
    const data = holder.data()!;
    assertVersion(data.version, input.expectedVersion);
    const eventId: string = data.eventId;
    const previous: number | null = typeof data.bib === "number" ? data.bib : null;
    if (previous === input.bib) return { bib: previous, version: data.version ?? 1 };

    const target = input.bib !== null ? await tx.get(bibRef(db, eventId, input.bib)) : null;
    const previousEntry = previous !== null ? await tx.get(bibRef(db, eventId, previous)) : null;
    if (target?.exists) {
      const taken = target.data()!;
      throw new ParticipantActionError(409, `Le dossard ${input.bib} est déjà attribué.`, "bib_taken", {
        holderType: taken.holderType,
        holderId: taken.holderId,
      });
    }

    if (previousEntry?.exists && previousEntry.data()!.holderId === holderRef.id) tx.delete(previousEntry.ref);
    if (input.bib !== null) {
      tx.create(bibRef(db, eventId, input.bib), {
        eventId,
        bib: input.bib,
        holderType: input.holderType,
        holderId: holderRef.id,
        assignedAt: at,
        assignedBy: context.actor.uid,
      });
    }
    const version = (data.version ?? 1) + 1;
    tx.update(holderRef, { bib: input.bib, version, updatedAt: at, updatedBy: context.actor.uid });
    audit(
      tx,
      db,
      { eventId, entity: input.holderType, entityId: holderRef.id, action: "bib.assign", before: { bib: previous }, after: { bib: input.bib } },
      context,
      at
    );
    return { bib: input.bib, version };
  });
}

/* ────────────────────────────── Création et équipes ────────────────────────────── */

/**
 * Ajout manuel d'un participant (ajout tardif, équipier manquant). Idempotent
 * grâce à `requestId` : un double clic ne crée pas deux fiches.
 */
export async function createParticipant(
  db: Firestore,
  input: { eventId: string; firstName: string; lastName: string; requestId: string; shirtSize?: string; note?: string },
  context: ActionContext
): Promise<{ participantId: string; created: boolean }> {
  const name = canonicalName(input);
  if (!isNameComplete(name)) throw new ParticipantActionError(400, "Le nom et le prénom sont obligatoires.", "name_required");
  if (!/^[\w-]{6,80}$/.test(input.requestId || "")) {
    throw new ParticipantActionError(400, "Identifiant de requête invalide.", "invalid_request_id");
  }
  const at = Timestamp.fromDate(context.now ?? new Date());
  const ref = db.collection("participants").doc(`adm_${input.requestId}`);

  return db.runTransaction(async tx => {
    const [existing, event] = await Promise.all([tx.get(ref), tx.get(db.collection("events").doc(input.eventId))]);
    if (existing.exists) return { participantId: ref.id, created: false };
    if (!event.exists) throw new ParticipantActionError(404, "Édition introuvable.", "event_not_found");
    tx.create(ref, {
      eventId: input.eventId,
      ...name,
      enteredAs: { firstName: input.firstName, lastName: input.lastName },
      nameKey: strictNameKey(name),
      looseNameKey: looseNameKey(name),
      ...(input.shirtSize ? { shirtSize: input.shirtSize } : {}),
      bib: null,
      buyerIds: [],
      createdFrom: "admin",
      sourcePaymentId: null,
      note: normalizeSpaces(input.note) || null,
      withdrawn: false,
      version: 1,
      createdAt: at,
      updatedAt: at,
      updatedBy: context.actor.uid,
    });
    audit(tx, db, { eventId: input.eventId, entity: "participant", entityId: ref.id, action: "participant.create", before: null, after: name }, context, at);
    return { participantId: ref.id, created: true };
  });
}

/**
 * Complète ou corrige les membres d'une équipe. Le créneau, le paiement et le
 * dossard de l'équipe sont conservés : aucun second passage n'est créé.
 */
export async function setTeamMembers(
  db: Firestore,
  input: { teamId: string; memberIds: string[]; expectedVersion?: number },
  context: ActionContext
): Promise<{ status: "complete" | "incomplete"; version: number }> {
  const memberIds = Array.from(new Set(input.memberIds.filter(Boolean)));
  if (memberIds.length !== input.memberIds.filter(Boolean).length) {
    throw new ParticipantActionError(400, "Un même participant ne peut pas occuper deux places de l'équipe.", "duplicate_member");
  }
  const at = Timestamp.fromDate(context.now ?? new Date());
  const teamRef = db.collection("teams").doc(input.teamId);

  return db.runTransaction(async tx => {
    const team = await tx.get(teamRef);
    if (!team.exists) throw new ParticipantActionError(404, "Équipe introuvable.", "not_found");
    const teamData = team.data()!;
    assertVersion(teamData.version, input.expectedVersion);
    if (memberIds.length > (teamData.requiredMembers ?? 2)) {
      throw new ParticipantActionError(400, `Cette équipe compte ${teamData.requiredMembers} membres au plus.`, "too_many_members");
    }
    const members = await Promise.all(memberIds.map(id => tx.get(db.collection("participants").doc(id))));
    const invalid = members.filter(member => !member.exists || member.data()!.eventId !== teamData.eventId);
    if (invalid.length > 0) {
      throw new ParticipantActionError(400, "Un équipier n'appartient pas à cette édition.", "member_other_event");
    }
    const slot = teamData.slotId ? await tx.get(db.collection("slots").doc(teamData.slotId)) : null;

    const status = memberIds.length >= (teamData.requiredMembers ?? 2) ? "complete" : "incomplete";
    const version = (teamData.version ?? 1) + 1;
    tx.update(teamRef, { memberIds, status, version, updatedAt: at });
    if (slot?.exists) {
      const copies = members.map(member => {
        const memberData = member.data()!;
        return {
          firstName: memberData.firstName,
          lastName: memberData.lastName,
          ...(memberData.shirtSize ? { shirtSize: memberData.shirtSize } : {}),
        };
      });
      tx.update(slot.ref, { participantIds: memberIds, participants: copies, participant: copies[0] ?? null });
    }
    audit(
      tx,
      db,
      {
        eventId: teamData.eventId,
        entity: "team",
        entityId: teamRef.id,
        action: "team.members",
        before: { memberIds: teamData.memberIds ?? [], status: teamData.status },
        after: { memberIds, status, names: members.map(member => displayName(member.data() as { firstName: string; lastName: string })) },
      },
      context,
      at
    );
    return { status, version };
  });
}

/**
 * Retire un participant des listes (ex. retiré du planning) sans rien effacer :
 * paiements et historique restent intacts.
 */
export async function setWithdrawn(
  db: Firestore,
  input: { participantId: string; withdrawn: boolean; expectedVersion?: number },
  context: ActionContext
): Promise<{ version: number }> {
  const at = Timestamp.fromDate(context.now ?? new Date());
  const ref = db.collection("participants").doc(input.participantId);
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new ParticipantActionError(404, "Participant introuvable.", "not_found");
    const data = snapshot.data()!;
    assertVersion(data.version, input.expectedVersion);
    const version = (data.version ?? 1) + 1;
    tx.update(ref, { withdrawn: input.withdrawn, version, updatedAt: at, updatedBy: context.actor.uid });
    audit(
      tx,
      db,
      { eventId: data.eventId, entity: "participant", entityId: ref.id, action: input.withdrawn ? "participant.withdraw" : "participant.reinstate", before: { withdrawn: !!data.withdrawn }, after: { withdrawn: input.withdrawn } },
      context,
      at
    );
    return { version };
  });
}

