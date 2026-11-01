// lib/server/booking/checkout-service.ts
// Préparation d'un paiement : contrôles serveur, prix recalculé, verrouillage
// transactionnel des créneaux. Le navigateur ne décide ni du prix, ni de
// l'acheteur, ni de l'édition.
//
// Le verrou dure plus longtemps que la session Stripe : une session encore
// payable possède toujours ses créneaux (sinon un autre acheteur pouvait les
// prendre pendant que le premier payait).

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { bookingRefusalReason, toDateOrNull } from "@/lib/domain/event-lifecycle";
import { getMinSlotsPerBooking, getParticipantsPerSlot, validateBookingSelection } from "@/lib/booking/rules";
import { clampPackQuantity, packAllowsCategory, packMealsIncluded, UNNAMED_PACK_MEAL } from "@/lib/booking/packs";
import { isNameComplete, normalizeSpaces } from "@/lib/domain/names";
import { verifyRuleAcceptances, type ClientRuleAcceptance } from "@/lib/server/rules/acceptance";
import type { Category, Participant, Product } from "@/types/firestore";

/** Durée de validité d'une session Stripe Checkout (minimum imposé par Stripe : 30 min). */
export const CHECKOUT_SESSION_TTL_MS = 31 * 60 * 1000;
/** Le verrou survit à la session : jamais de créneau libéré pendant un paiement possible. */
export const SLOT_LOCK_TTL_MS = CHECKOUT_SESSION_TTL_MS + 4 * 60 * 1000;

export class CheckoutError extends Error {
  constructor(public status: number, message: string, public code: string, public details?: unknown) {
    super(message);
  }
}

export interface CheckoutSlotInput {
  slotId: string;
  participants?: Partial<Participant>[];
  participant?: Partial<Participant>;
}

export interface CheckoutInput {
  buyer: { uid: string; email: string };
  eventId: string;
  slots: CheckoutSlotInput[];
  mealGuests?: { firstName?: string; lastName?: string; email?: string; phone?: string; isParticipant?: boolean }[];
  pack?: { productId: string; quantity?: number };
  ruleAcceptances?: ClientRuleAcceptance[];
  /** Montant affiché au client : un écart signale un prix modifié entre-temps. */
  clientTotal?: number;
  /** Langue du Booking : messages de validation renvoyés dans cette langue. */
  lang?: string;
  now?: Date;
}

export interface PreparedCheckout {
  pendingBookingId: string;
  totalAmount: number;
  lineItems: Array<{ name: string; description: string; unitAmountCents: number; quantity: number }>;
  metadata: Record<string, string>;
  slotIds: string[];
  lockedUntil: Date;
}

function cleanParticipant(participant: Partial<Participant> | undefined): Participant | undefined {
  if (!participant) return undefined;
  const cleaned: Participant = {
    firstName: normalizeSpaces(participant.firstName),
    lastName: normalizeSpaces(participant.lastName),
  };
  if (participant.email?.trim()) cleaned.email = participant.email.trim();
  if (participant.phone?.trim()) cleaned.phone = participant.phone.trim();
  if (participant.shirtSize) cleaned.shirtSize = participant.shirtSize;
  return cleaned;
}

function participantsOf(slot: CheckoutSlotInput): Participant[] {
  const list = Array.isArray(slot.participants) && slot.participants.length > 0 ? slot.participants : slot.participant ? [slot.participant] : [];
  return list.map(cleanParticipant).filter((participant): participant is Participant => !!participant);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function prepareCheckout(db: Firestore, input: CheckoutInput): Promise<PreparedCheckout> {
  const now = input.now ?? new Date();
  const lockedUntil = new Date(now.getTime() + SLOT_LOCK_TTL_MS);
  const pendingRef = db.collection("pendingBookings").doc();

  const slotIds = input.slots.map(slot => slot.slotId);
  if (new Set(slotIds).size !== slotIds.length) {
    throw new CheckoutError(400, "Un créneau est sélectionné plusieurs fois.", "duplicate_slot");
  }

  return db.runTransaction(async tx => {
    // ── Édition ──
    const eventSnapshot = await tx.get(db.collection("events").doc(input.eventId || "_"));
    const eventData = eventSnapshot.data();
    const refusal = bookingRefusalReason(
      eventData ? { status: eventData.status, registrationDeadline: toDateOrNull(eventData.registrationDeadline) } : null,
      now
    );
    if (refusal) {
      throw new CheckoutError(
        409,
        refusal === "registration_deadline_passed"
          ? "Les inscriptions à cette édition sont closes."
          : "Cette édition n'est pas ouverte aux inscriptions.",
        refusal
      );
    }

    // ── Pack éventuel ──
    let product: Product | null = null;
    let packQuantity = 1;
    if (input.pack) {
      const productSnapshot = await tx.get(db.collection("products").doc(input.pack.productId || "_"));
      product = productSnapshot.exists ? ({ id: productSnapshot.id, ...productSnapshot.data() } as Product) : null;
      if (!product || !product.isActive || product.eventId !== input.eventId) {
        throw new CheckoutError(409, "Ce pack n'est plus disponible.", "pack_unavailable");
      }
      packQuantity = clampPackQuantity(input.pack.quantity ?? 1);
      const expected = (Number(product.slotsRequired) || 0) * packQuantity;
      if (input.slots.length !== expected) {
        throw new CheckoutError(
          400,
          `Ce pack demande ${expected} créneau(x) (${packQuantity} × ${product.slotsRequired}), ${input.slots.length} sélectionné(s).`,
          "pack_slot_count"
        );
      }
    }

    // ── Créneaux et catégories ──
    const slotSnapshots = await Promise.all(slotIds.map(id => tx.get(db.collection("slots").doc(id))));
    const categoryIds = Array.from(new Set(slotSnapshots.map(snapshot => snapshot.data()?.categoryId as string).filter(Boolean)));
    const categorySnapshots = await Promise.all(categoryIds.map(id => tx.get(db.collection("categories").doc(id))));
    const categories = new Map<string, Category>(
      categorySnapshots.filter(snapshot => snapshot.exists).map(snapshot => [snapshot.id, { id: snapshot.id, ...snapshot.data() } as Category])
    );
    const ruleCheck = await verifyRuleAcceptances(tx, db, {
      event: { id: input.eventId, rulesAcceptanceRequired: !!eventData?.rulesAcceptanceRequired },
      categoryIds,
      acceptances: input.ruleAcceptances ?? [],
    });

    const unavailable: string[] = [];
    slotSnapshots.forEach(snapshot => {
      const data = snapshot.data();
      const category = data ? categories.get(data.categoryId) : undefined;
      const lockExpired = (toDateOrNull(data?.lockedUntil)?.getTime() ?? 0) < now.getTime();
      const reservable =
        !!data &&
        data.eventId === input.eventId &&
        !!category &&
        category.isActive !== false &&
        category.eventId === input.eventId &&
        (data.status === "available" ||
          (data.status === "locked" && (data.lockedByUserId === input.buyer.uid || lockExpired)));
      if (!reservable) unavailable.push(snapshot.id);
    });
    if (unavailable.length > 0) {
      throw new CheckoutError(409, "Un ou plusieurs créneaux ne sont plus disponibles.", "slot_unavailable", { slotIds: unavailable });
    }
    if (ruleCheck.missing.length > 0) {
      throw new CheckoutError(
        409,
        "Le règlement de chaque catégorie doit être accepté dans sa version en vigueur.",
        "rules_acceptance_required",
        { categories: ruleCheck.missing }
      );
    }

    if (product) {
      const excluded = slotSnapshots.filter(snapshot => !packAllowsCategory(product, snapshot.data()!.categoryId));
      if (excluded.length > 0) {
        throw new CheckoutError(400, "Une des catégories choisies n'est pas incluse dans ce pack.", "pack_category_excluded");
      }
    }

    const slotsWithParticipants = input.slots.map((slot, index) => ({
      slotId: slot.slotId,
      categoryId: slotSnapshots[index].data()!.categoryId as string,
      participants: participantsOf(slot),
      startTime: toDateOrNull(slotSnapshots[index].data()!.startTime),
      endTime: toDateOrNull(slotSnapshots[index].data()!.endTime),
    }));
    const ruleErrors = validateBookingSelection({
      slots: slotsWithParticipants,
      participantsPerCategory: Object.fromEntries(categoryIds.map(id => [id, getParticipantsPerSlot(categories.get(id))])),
      categoryNames: Object.fromEntries(categoryIds.map(id => [id, categories.get(id)?.name || "cette catégorie"])),
      minSlots: product ? 1 : getMinSlotsPerBooking(eventData),
      lang: input.lang,
    });
    if (ruleErrors.length > 0) {
      throw new CheckoutError(400, ruleErrors.join(" "), "booking_rules", { errors: ruleErrors });
    }

    // ── Prix (base de données uniquement) ──
    const lineItems: PreparedCheckout["lineItems"] = [];
    let mealGuests: { firstName: string; lastName: string; email?: string; phone?: string; isParticipant?: boolean }[] = [];
    let mealPrice = 0;
    let totalAmount: number;

    if (product) {
      totalAmount = round2(Number(product.unitAmount) * packQuantity);
      const mealsPerPack = packMealsIncluded(product);
      const mealQuantity = mealsPerPack * packQuantity;
      const named = (input.mealGuests ?? [])
        .map(guest => ({ firstName: normalizeSpaces(guest.firstName), lastName: normalizeSpaces(guest.lastName) }))
        .filter(guest => isNameComplete(guest))
        .slice(0, mealQuantity);
      mealGuests = [...named, ...Array.from({ length: mealQuantity - named.length }, () => ({ ...UNNAMED_PACK_MEAL }))];
      lineItems.push({
        name: `Pack - ${product.name}`,
        description: `${product.slotsRequired} créneau(x) de compétition` + (mealsPerPack ? ` + ${mealsPerPack} repas` : ""),
        unitAmountCents: Math.round(Number(product.unitAmount) * 100),
        quantity: packQuantity,
      });
    } else {
      const slotTotal = round2(
        slotsWithParticipants.reduce((sum, slot) => sum + Number(categories.get(slot.categoryId)?.unitPrice || 0), 0)
      );
      mealPrice = Number(eventData?.mealPrice || 0);
      mealGuests = (input.mealGuests ?? [])
        .map(guest => ({
          firstName: normalizeSpaces(guest.firstName),
          lastName: normalizeSpaces(guest.lastName),
          ...(guest.email?.trim() ? { email: guest.email.trim() } : {}),
          ...(guest.phone?.trim() ? { phone: guest.phone.trim() } : {}),
          isParticipant: !!guest.isParticipant,
        }))
        .filter(guest => isNameComplete(guest));
      if (mealGuests.length > 0 && mealPrice <= 0) {
        throw new CheckoutError(409, "Les repas ne sont pas en vente pour cette édition.", "meals_unavailable");
      }
      if (slotsWithParticipants.length === 0 && mealGuests.length === 0) {
        throw new CheckoutError(400, "Ajoutez au moins un créneau ou un repas.", "empty_cart");
      }
      if (slotTotal > 0) {
        lineItems.push({
          name: `Créneaux de Compétition - ${slotsWithParticipants.length} créneau(x)`,
          description: `Réservation de ${slotsWithParticipants.length} créneau(x) de compétition`,
          unitAmountCents: Math.round(slotTotal * 100),
          quantity: 1,
        });
      }
      if (mealGuests.length > 0) {
        lineItems.push({
          name: "Repas",
          description: `Repas pendant l'événement pour ${mealGuests.length} personne(s)`,
          unitAmountCents: Math.round(mealPrice * 100),
          quantity: mealGuests.length,
        });
      }
      totalAmount = round2(slotTotal + mealPrice * mealGuests.length);
    }

    if (!(totalAmount > 0) || lineItems.length === 0) {
      throw new CheckoutError(400, "Montant à payer invalide.", "invalid_amount");
    }
    if (typeof input.clientTotal === "number" && Math.abs(input.clientTotal - totalAmount) > 0.009) {
      throw new CheckoutError(409, "Le prix a changé depuis l'affichage. Rechargez la page pour voir le montant à jour.", "price_changed", {
        serverTotal: totalAmount,
      });
    }

    // ── Écritures : réservation en attente + verrous ──
    const nowTs = Timestamp.fromDate(now);
    const pendingSlots = slotsWithParticipants.map(slot => ({
      slotId: slot.slotId,
      categoryId: slot.categoryId,
      participant: slot.participants[0] ?? null,
      participants: slot.participants,
    }));
    tx.create(pendingRef, {
      userId: input.buyer.uid,
      userEmail: input.buyer.email,
      eventId: input.eventId,
      isPack: !!product,
      packId: product?.id ?? null,
      packName: product?.name ?? null,
      packQuantity: product ? packQuantity : null,
      totalAmount,
      includeMeal: mealGuests.length > 0,
      mealPrice,
      mealQuantity: mealGuests.length,
      slots: pendingSlots,
      mealGuests,
      ruleAcceptances: ruleCheck.accepted,
      status: "pending",
      stripeSessionId: null,
      lockedUntil: Timestamp.fromDate(lockedUntil),
      createdAt: nowTs,
    });
    slotSnapshots.forEach((snapshot, index) => {
      tx.update(snapshot.ref, {
        status: "locked",
        lockedByUserId: input.buyer.uid,
        lockedUntil: Timestamp.fromDate(lockedUntil),
        pendingBookingId: pendingRef.id,
        stripeSessionId: null,
        buyerId: input.buyer.uid,
        participant: pendingSlots[index].participant,
        participants: pendingSlots[index].participants,
        ...(product ? { packId: product.id } : {}),
      });
    });

    const metadata: Record<string, string> = {
      bookingRef: pendingRef.id,
      userId: input.buyer.uid,
      userEmail: input.buyer.email,
      eventId: input.eventId,
      isPack: product ? "true" : "false",
      slotCount: String(slotIds.length),
      includeMeal: mealGuests.length > 0 ? "true" : "false",
      mealPrice: String(mealPrice),
      mealQuantity: String(mealGuests.length),
    };
    if (product) {
      metadata.packId = product.id;
      metadata.packName = product.name.slice(0, 500);
    }
    const joinedSlotIds = slotIds.join(",");
    if (joinedSlotIds && joinedSlotIds.length <= 500) metadata.slotIds = joinedSlotIds;

    return { pendingBookingId: pendingRef.id, totalAmount, lineItems, metadata, slotIds, lockedUntil };
  });
}

/** Rattache la session Stripe créée à la réservation et à ses créneaux. */
export async function attachCheckoutSession(db: Firestore, prepared: PreparedCheckout, sessionId: string): Promise<void> {
  const batch = db.batch();
  batch.update(db.collection("pendingBookings").doc(prepared.pendingBookingId), {
    stripeSessionId: sessionId,
    updatedAt: Timestamp.now(),
  });
  prepared.slotIds.forEach(slotId => batch.update(db.collection("slots").doc(slotId), { stripeSessionId: sessionId }));
  await batch.commit();
}

/** Session Stripe impossible à créer : on libère les verrous posés par CETTE réservation. */
export async function releaseCheckout(db: Firestore, prepared: Pick<PreparedCheckout, "pendingBookingId" | "slotIds">): Promise<void> {
  await db.runTransaction(async tx => {
    const snapshots = await Promise.all(prepared.slotIds.map(id => tx.get(db.collection("slots").doc(id))));
    snapshots.forEach(snapshot => {
      const data = snapshot.data();
      if (data?.status === "locked" && data.pendingBookingId === prepared.pendingBookingId) {
        tx.update(snapshot.ref, {
          status: "available",
          lockedByUserId: null,
          lockedUntil: null,
          pendingBookingId: null,
          stripeSessionId: null,
          buyerId: null,
          participant: null,
          participants: [],
        });
      }
    });
    tx.update(db.collection("pendingBookings").doc(prepared.pendingBookingId), { status: "failed", updatedAt: Timestamp.now() });
  });
}
