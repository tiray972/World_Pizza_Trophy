// lib/server/payments/finalize.ts
// Finalisation UNIQUE d'une session Stripe payée.
//
// Appelée par le webhook, par la page de succès et par le rattrapage : quel que
// soit l'ordre ou le nombre d'appels (y compris simultanés), une session donne
// exactement un paiement, ses inscriptions, ses équipes et ses places repas.
//
// Invariants :
//  - l'identifiant du paiement est l'identifiant de la session Stripe ;
//  - tout est écrit dans une seule transaction (rien de partiel) ;
//  - un créneau déjà attribué à quelqu'un d'autre n'est jamais écrasé : le
//    conflit est enregistré et le paiement marqué « à vérifier » ;
//  - un repas payé = une place, nommée ou « à compléter » (jamais le nom de
//    l'acheteur par défaut) ;
//  - aucun participant n'est fusionné sur une ressemblance de nom.

import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import { canonicalName, isNameComplete, looseNameKey, strictNameKey } from "@/lib/domain/names";
import { getParticipantsPerSlot } from "@/lib/booking/rules";
import { UNNAMED_PACK_MEAL } from "@/lib/booking/packs";
import type { SlotConflict } from "@/types/firestore";

export interface PayloadParticipant {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  shirtSize?: string;
}

export interface PayloadSlot {
  slotId: string;
  categoryId?: string;
  participant?: PayloadParticipant;
  participants?: PayloadParticipant[];
}

export interface PayloadMealGuest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  isParticipant?: boolean;
}

export interface PayloadRuleAcceptance {
  categoryId: string;
  ruleVersionId: string;
  version: number;
  requestedLang: string;
  displayedLang: string;
  acceptedAt: string;
}

/** Vue d'une session Stripe, indépendante du SDK (testable sans Stripe). */
export interface CheckoutSessionSnapshot {
  id: string;
  paymentStatus: string;
  amountTotal: number; // centimes
  customerId?: string | null;
  metadata: Record<string, string>;
  invoice?: { number: string | null; hostedUrl: string | null; pdfUrl: string | null } | null;
}

export type FinalizeSource = "webhook" | "success_page" | "recovery" | "admin";

export interface FinalizeResult {
  status: "created" | "already_finalized" | "not_paid" | "payload_missing";
  paymentId: string | null;
  slotIds: string[];
  conflicts: SlotConflict[];
  participantIds: string[];
  teamIds: string[];
  mealSeatIds: string[];
  /** Données utiles aux notifications (uniquement quand status = created). */
  notification?: {
    userEmail: string;
    userName?: string;
    eventId: string;
    amount: number;
    isPack: boolean;
    packName?: string;
    participants: PayloadParticipant[];
    mealGuests: PayloadMealGuest[];
    mealPrice: number;
    mealQuantity: number;
  };
}

interface ResolvedPayload {
  slots: PayloadSlot[];
  mealGuests: PayloadMealGuest[];
  ruleAcceptances: PayloadRuleAcceptance[];
  pendingRef: DocumentReference | null;
}

function parseJsonArray<T>(value: string | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function payloadFrom(
  session: CheckoutSessionSnapshot,
  pending: DocumentSnapshot | null
): ResolvedPayload | null {
  if (pending?.exists) {
    const data = pending.data() || {};
    return {
      slots: Array.isArray(data.slots) ? data.slots : [],
      mealGuests: Array.isArray(data.mealGuests) ? data.mealGuests : [],
      ruleAcceptances: Array.isArray(data.ruleAcceptances) ? data.ruleAcceptances : [],
      pendingRef: pending.ref,
    };
  }
  // Anciennes sessions : charge utile en JSON dans les metadata.
  const slots = parseJsonArray<PayloadSlot>(session.metadata.slotsToReserve);
  const mealGuests = parseJsonArray<PayloadMealGuest>(session.metadata.mealGuests);
  if (slots.length === 0 && mealGuests.length === 0) return null;
  return { slots, mealGuests, ruleAcceptances: [], pendingRef: null };
}

function participantsOfSlot(slot: PayloadSlot): PayloadParticipant[] {
  const list =
    Array.isArray(slot.participants) && slot.participants.length > 0
      ? slot.participants
      : slot.participant
        ? [slot.participant]
        : [];
  return list.filter(participant => isNameComplete(participant as { firstName: string; lastName: string }));
}

function isUnnamedMeal(guest: PayloadMealGuest): boolean {
  return (
    !isNameComplete(guest as { firstName: string; lastName: string }) ||
    (guest.firstName === UNNAMED_PACK_MEAL.firstName && guest.lastName === UNNAMED_PACK_MEAL.lastName)
  );
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

/** Le créneau peut-il recevoir ce paiement ? Sinon, raison du conflit. */
function slotClaim(
  snapshot: DocumentSnapshot,
  sessionId: string,
  eventId: string,
  now: Date,
  bookingRef?: string
): SlotConflict | null {
  if (!snapshot.exists) return { slotId: snapshot.id, reason: "missing" };
  const data = snapshot.data() || {};
  if (eventId && data.eventId && data.eventId !== eventId) {
    return { slotId: snapshot.id, reason: "other_event", currentStatus: data.status };
  }
  // Verrou posé par cette commande (la session peut ne pas y être encore rattachée).
  const sameSession =
    data.stripeSessionId === sessionId || (!!bookingRef && data.pendingBookingId === bookingRef);
  if (data.status === "available") return null;
  if (sameSession && (data.status === "locked" || data.status === "paid")) return null;
  if (data.status === "locked") {
    const lockedUntil = toDate(data.lockedUntil);
    if (lockedUntil && lockedUntil.getTime() < now.getTime()) return null;
  }
  return {
    slotId: snapshot.id,
    reason: data.status === "offered" ? "offered" : "taken_by_other",
    currentStatus: data.status,
    currentSessionId: data.stripeSessionId ?? null,
    currentBuyerId: data.buyerId ?? null,
  };
}

export async function finalizeCheckoutSession(
  db: Firestore,
  session: CheckoutSessionSnapshot,
  options: { source: FinalizeSource; now?: Date }
): Promise<FinalizeResult> {
  const empty: FinalizeResult = {
    status: "not_paid",
    paymentId: null,
    slotIds: [],
    conflicts: [],
    participantIds: [],
    teamIds: [],
    mealSeatIds: [],
  };
  if (session.paymentStatus !== "paid") return empty;

  const metadata = session.metadata || {};
  const userId = metadata.userId || "";
  const eventId = metadata.eventId || "";
  const isPack = metadata.isPack === "true";
  const mealPrice = Number(metadata.mealPrice || 0);
  const now = options.now ?? new Date();
  const nowTs = Timestamp.fromDate(now);
  const paymentRef = db.collection("payments").doc(session.id);

  return db.runTransaction(async (tx: Transaction): Promise<FinalizeResult> => {
    // ───────────── Lectures (toutes avant la première écriture) ─────────────
    const existing = await tx.get(paymentRef);
    if (existing.exists) {
      return { ...empty, status: "already_finalized", paymentId: existing.id };
    }
    // Paiements enregistrés par l'ancien code, sous un identifiant aléatoire.
    const legacy = await tx.get(
      db.collection("payments").where("stripeSessionId", "==", session.id).limit(1)
    );
    if (!legacy.empty) {
      return { ...empty, status: "already_finalized", paymentId: legacy.docs[0].id };
    }

    const pending = metadata.bookingRef
      ? await tx.get(db.collection("pendingBookings").doc(metadata.bookingRef))
      : null;
    const payload = payloadFrom(session, pending);
    if (!payload || !userId) {
      tx.set(
        db.collection("paymentIncidents").doc(session.id),
        {
          stripeSessionId: session.id,
          eventId,
          userId,
          reason: "payload_missing",
          details: { bookingRef: metadata.bookingRef || null, amountTotal: session.amountTotal },
          resolved: false,
          createdAt: nowTs,
          updatedAt: nowTs,
        },
        { merge: true }
      );
      return { ...empty, status: "payload_missing" };
    }

    const slotSnapshots = await Promise.all(
      payload.slots.map(slot => tx.get(db.collection("slots").doc(slot.slotId)))
    );
    const categoryIds = Array.from(
      new Set(
        payload.slots
          .map((slot, index) => (slotSnapshots[index].data()?.categoryId as string) || slot.categoryId || "")
          .filter(Boolean)
      )
    );
    const categorySnapshots = await Promise.all(
      categoryIds.map(categoryId => tx.get(db.collection("categories").doc(categoryId)))
    );
    const categories = new Map(categorySnapshots.map(snapshot => [snapshot.id, snapshot.data() || {}]));
    const userSnapshot = await tx.get(db.collection("users").doc(userId));
    const buyerParticipants = await tx.get(
      db.collection("participants").where("buyerIds", "array-contains", userId)
    );

    // ───────────── Identités : réutilisation stricte, sinon création ─────────────
    const existingByKey = new Map<string, string>();
    buyerParticipants.docs
      .filter(doc => doc.data().eventId === eventId)
      .forEach(doc => existingByKey.set(doc.data().nameKey, doc.id));

    const orderByKey = new Map<string, string>();
    const newParticipants: Array<{ id: string; data: Record<string, unknown> }> = [];
    const participantIdFor = (participant: PayloadParticipant): string => {
      const canonical = canonicalName(participant);
      const key = strictNameKey(canonical);
      const known = orderByKey.get(key) ?? existingByKey.get(key);
      if (known) {
        orderByKey.set(key, known);
        return known;
      }
      const id = `${session.id}_p${newParticipants.length + 1}`;
      orderByKey.set(key, id);
      newParticipants.push({
        id,
        data: stripUndefined({
          eventId,
          firstName: canonical.firstName,
          lastName: canonical.lastName,
          enteredAs: { firstName: participant.firstName || "", lastName: participant.lastName || "" },
          nameKey: key,
          looseNameKey: looseNameKey(canonical),
          email: participant.email?.trim() || undefined,
          phone: participant.phone?.trim() || undefined,
          shirtSize: participant.shirtSize || undefined,
          bib: null,
          buyerIds: [userId],
          createdFrom: "checkout",
          sourcePaymentId: session.id,
          withdrawn: false,
          version: 1,
          createdAt: nowTs,
          updatedAt: nowTs,
        }),
      });
      return id;
    };

    // ───────────── Créneaux ─────────────
    const conflicts: SlotConflict[] = [];
    const acceptedSlotIds: string[] = [];
    const teamIds: string[] = [];
    const slotWrites: Array<() => void> = [];
    const allParticipantsForEmail: PayloadParticipant[] = [];
    const acceptedCategoryIds = new Set<string>();
    const participantIdsByCategory = new Map<string, string[]>();
    const teamIdsByCategory = new Map<string, string[]>();

    payload.slots.forEach((slot, index) => {
      const snapshot = slotSnapshots[index];
      const participants = participantsOfSlot(slot);
      allParticipantsForEmail.push(...participants);
      const participantIds = participants.map(participantIdFor);
      const categoryId = (snapshot.data()?.categoryId as string) || slot.categoryId || "";
      participantIdsByCategory.set(categoryId, [
        ...(participantIdsByCategory.get(categoryId) ?? []),
        ...participantIds,
      ]);

      const conflict = slotClaim(snapshot, session.id, eventId, now, metadata.bookingRef);
      if (conflict) {
        conflicts.push(conflict);
        return;
      }
      acceptedSlotIds.push(snapshot.id);
      acceptedCategoryIds.add(categoryId);

      const required = getParticipantsPerSlot(categories.get(categoryId));
      let teamId: string | null = null;
      if (required > 1) {
        teamId = `${session.id}_t_${snapshot.id}`;
        teamIds.push(teamId);
        teamIdsByCategory.set(categoryId, [...(teamIdsByCategory.get(categoryId) ?? []), teamId]);
        const teamData = {
          eventId,
          categoryId,
          slotId: snapshot.id,
          memberIds: participantIds,
          requiredMembers: required,
          status: participantIds.length >= required ? "complete" : "incomplete",
          bib: null,
          displayName: null,
          buyerId: userId,
          createdFrom: "checkout",
          sourcePaymentId: session.id,
          version: 1,
          createdAt: nowTs,
          updatedAt: nowTs,
        };
        slotWrites.push(() => tx.create(db.collection("teams").doc(teamId!), teamData));
      }

      const copies = participants.map(participant =>
        stripUndefined({
          ...canonicalName(participant),
          email: participant.email?.trim() || undefined,
          phone: participant.phone?.trim() || undefined,
          shirtSize: participant.shirtSize || undefined,
        })
      );
      slotWrites.push(() =>
        tx.update(snapshot.ref, {
          buyerId: userId,
          status: "paid",
          participant: copies[0] ?? null,
          participants: copies,
          participantIds,
          teamId,
          stripeSessionId: session.id,
          assignmentType: "payment",
          paidAt: nowTs,
          lockedByUserId: FieldValue.delete(),
          lockedUntil: FieldValue.delete(),
          pendingBookingId: FieldValue.delete(),
        })
      );
    });

    // ───────────── Repas : une place par repas payé ─────────────
    const metadataQuantity = Number(metadata.mealQuantity || 0);
    const seatsInOrder = Math.max(payload.mealGuests.length, Number.isFinite(metadataQuantity) ? metadataQuantity : 0);
    const mealSeatIds: string[] = [];
    const seatWrites: Array<() => void> = [];
    for (let seatIndex = 0; seatIndex < seatsInOrder; seatIndex++) {
      const guest = payload.mealGuests[seatIndex];
      const named = guest && !isUnnamedMeal(guest) ? canonicalName(guest) : null;
      const linkedParticipant = named && guest?.isParticipant ? orderByKey.get(strictNameKey(named)) ?? null : null;
      const seatId = `${session.id}_m${seatIndex + 1}`;
      mealSeatIds.push(seatId);
      seatWrites.push(() =>
        tx.create(db.collection("mealSeats").doc(seatId), {
          eventId,
          paymentId: session.id,
          stripeSessionId: session.id,
          buyerId: userId,
          seatIndex,
          seatsInOrder,
          beneficiary: named,
          beneficiaryParticipantId: linkedParticipant,
          mealLabel: null,
          unitPrice: isPack ? null : mealPrice || null,
          includedInPack: isPack,
          source: isPack ? "pack" : "checkout",
          financialStatus: "paid",
          attendance: { present: false },
          createdAt: nowTs,
          updatedAt: nowTs,
        })
      );
    }

    // ───────────── Écritures ─────────────
    newParticipants.forEach(({ id, data }) => tx.create(db.collection("participants").doc(id), data));
    slotWrites.forEach(write => write());
    seatWrites.forEach(write => write());

    const participantIds = Array.from(new Set(Array.from(orderByKey.values())));
    tx.create(
      paymentRef,
      stripUndefined({
        id: session.id,
        eventId,
        userId,
        stripeSessionId: session.id,
        amount: session.amountTotal / 100,
        amountTotalCents: session.amountTotal,
        status: "paid",
        source: "stripe",
        slotIds: acceptedSlotIds,
        isPack,
        packName: isPack ? metadata.packName : undefined,
        packId: isPack ? metadata.packId : undefined,
        metadata: {
          ...metadata,
          // Champs historiques encore lus par les exports existants.
          slotsToReserve: JSON.stringify(payload.slots),
          mealGuests: JSON.stringify(payload.mealGuests),
        },
        participantIds,
        teamIds,
        mealSeatIds,
        slotConflicts: conflicts,
        needsReview: conflicts.length > 0,
        finalizedVia: options.source,
        stripeInvoiceNumber: session.invoice?.number ?? undefined,
        stripeInvoiceUrl: session.invoice?.hostedUrl ?? undefined,
        stripeInvoicePdf: session.invoice?.pdfUrl ?? undefined,
        createdAt: nowTs,
        updatedAt: nowTs,
      })
    );

    if (conflicts.length > 0) {
      tx.set(db.collection("paymentIncidents").doc(session.id), {
        stripeSessionId: session.id,
        eventId,
        userId,
        reason: "slot_conflict",
        details: { conflicts },
        resolved: false,
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    }

    // Acceptations de règlement : rattachées à la commande réellement payée.
    payload.ruleAcceptances.forEach(acceptance => {
      tx.set(db.collection("ruleAcceptances").doc(`${session.id}_${acceptance.categoryId}`), {
        eventId,
        categoryId: acceptance.categoryId,
        ruleVersionId: acceptance.ruleVersionId,
        version: acceptance.version,
        requestedLang: acceptance.requestedLang,
        displayedLang: acceptance.displayedLang,
        acceptedAt: Timestamp.fromDate(new Date(acceptance.acceptedAt)),
        actorUserId: userId,
        actorRole: "buyer",
        paymentId: session.id,
        pendingBookingId: payload.pendingRef?.id ?? null,
        participantIds: participantIdsByCategory.get(acceptance.categoryId) ?? [],
        teamIds: teamIdsByCategory.get(acceptance.categoryId) ?? [],
        recordedAt: nowTs,
      });
    });

    // Inscriptions du compte acheteur (structure historique conservée).
    if (acceptedSlotIds.length > 0 && userSnapshot.exists) {
      const registrations = { ...(userSnapshot.data()?.registrations || {}) };
      const current = registrations[eventId] || {};
      registrations[eventId] = stripUndefined({
        ...current,
        paid: true,
        categoryIds: Array.from(new Set([...(current.categoryIds || []), ...acceptedCategoryIds])),
        stripeCustomerId: session.customerId || current.stripeCustomerId || undefined,
        paymentId: session.id,
        registeredAt: current.registeredAt || nowTs,
      });
      tx.update(userSnapshot.ref, { registrations });
    }

    if (payload.pendingRef) {
      tx.update(payload.pendingRef, { status: "paid", paymentId: session.id, updatedAt: nowTs });
    }

    const profile = userSnapshot.data();
    return {
      status: "created",
      paymentId: session.id,
      slotIds: acceptedSlotIds,
      conflicts,
      participantIds,
      teamIds,
      mealSeatIds,
      notification: {
        userEmail: metadata.userEmail || profile?.email || "",
        userName: profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : undefined,
        eventId,
        amount: session.amountTotal / 100,
        isPack,
        packName: metadata.packName,
        participants: allParticipantsForEmail,
        mealGuests: payload.mealGuests,
        mealPrice,
        mealQuantity: seatsInOrder,
      },
    };
  });
}
