// lib/booking/pending-booking.ts
// Stripe limite chaque valeur de metadata à 500 caractères (et 50 clés max).
// Avec plusieurs créneaux + participants, le JSON dépassait cette limite et
// Stripe renvoyait une erreur -> checkout impossible dès ~3 créneaux.
// On stocke donc la charge utile dans Firestore et on ne met qu'une référence
// courte dans les metadata Stripe.

import { adminDB } from "@/lib/firebase/admin";
import * as admin from "firebase-admin";
import Stripe from "stripe";

export const STRIPE_METADATA_VALUE_LIMIT = 500;

export interface BookingParticipant {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  shirtSize?: string;
}

export interface BookingMealGuest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isParticipant?: boolean;
}

export interface BookingSlot {
  slotId: string;
  categoryId?: string;
  participant?: BookingParticipant;
}

export interface PendingBookingPayload {
  userId: string;
  userEmail: string;
  eventId: string;
  isPack: boolean;
  packId?: string;
  packName?: string;
  totalAmount: number;
  includeMeal?: boolean;
  mealPrice?: number;
  mealQuantity?: number;
  slots: BookingSlot[];
  mealGuests?: BookingMealGuest[];
}

/** Firestore refuse les valeurs `undefined` : on nettoie récursivement. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => stripUndefined(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val === undefined) continue;
      cleaned[key] = stripUndefined(val);
    }
    return cleaned as T;
  }
  return value;
}

/** Crée le document de réservation en attente et renvoie son id. */
export async function createPendingBooking(
  payload: PendingBookingPayload
): Promise<string> {
  const ref = adminDB.collection("pendingBookings").doc();
  await ref.set(
    stripUndefined({
      ...payload,
      status: "pending",
      createdAt: admin.firestore.Timestamp.now(),
    })
  );
  return ref.id;
}

/** Associe la session Stripe au document de réservation en attente. */
export async function attachSessionToPendingBooking(
  bookingRef: string,
  sessionId: string
): Promise<void> {
  await adminDB.collection("pendingBookings").doc(bookingRef).update({
    stripeSessionId: sessionId,
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

/** Supprime la réservation en attente si la session Stripe n'a pas pu être créée. */
export async function deletePendingBooking(bookingRef: string): Promise<void> {
  try {
    await adminDB.collection("pendingBookings").doc(bookingRef).delete();
  } catch (error) {
    console.error(`⚠️ Impossible de supprimer pendingBooking ${bookingRef}:`, error);
  }
}

/**
 * Metadata Stripe : uniquement des valeurs courtes.
 * `slotIds` n'est ajouté que s'il tient dans la limite de 500 caractères.
 */
export function buildBookingMetadata(
  payload: PendingBookingPayload,
  bookingRef: string
): Stripe.MetadataParam {
  const metadata: Stripe.MetadataParam = {
    bookingRef,
    userId: payload.userId,
    userEmail: payload.userEmail,
    eventId: payload.eventId || "",
    isPack: payload.isPack ? "true" : "false",
    slotCount: String(payload.slots.length),
    includeMeal: payload.includeMeal ? "true" : "false",
    mealPrice: String(payload.mealPrice ?? 0),
    mealQuantity: String(payload.mealQuantity ?? 0),
  };

  if (payload.packId) metadata.packId = payload.packId;
  if (payload.packName) metadata.packName = payload.packName.slice(0, STRIPE_METADATA_VALUE_LIMIT);

  const slotIds = payload.slots.map(slot => slot.slotId).join(",");
  if (slotIds.length > 0 && slotIds.length <= STRIPE_METADATA_VALUE_LIMIT) {
    metadata.slotIds = slotIds;
  }

  return metadata;
}

/**
 * Relit la charge utile d'une session Stripe.
 * Nouveau format : document `pendingBookings`.
 * Ancien format : JSON dans les metadata (sessions créées avant ce correctif).
 */
export async function resolveBookingPayload(
  session: Stripe.Checkout.Session
): Promise<{ slots: BookingSlot[]; mealGuests: BookingMealGuest[] } | null> {
  const metadata = (session.metadata || {}) as Record<string, string>;

  if (metadata.bookingRef) {
    const doc = await adminDB.collection("pendingBookings").doc(metadata.bookingRef).get();
    if (doc.exists) {
      const data = doc.data() as PendingBookingPayload | undefined;
      return {
        slots: Array.isArray(data?.slots) ? data!.slots : [],
        mealGuests: Array.isArray(data?.mealGuests) ? data!.mealGuests : [],
      };
    }
    console.error(`❌ pendingBooking introuvable: ${metadata.bookingRef}`);
  }

  // Rétrocompatibilité : anciennes sessions avec le JSON dans les metadata.
  let slots: BookingSlot[] = [];
  let mealGuests: BookingMealGuest[] = [];
  try {
    const parsedSlots = metadata.slotsToReserve ? JSON.parse(metadata.slotsToReserve) : [];
    slots = Array.isArray(parsedSlots) ? parsedSlots : [];
  } catch (error) {
    console.error("❌ slotsToReserve illisible dans les metadata:", error);
  }
  try {
    const parsedGuests = metadata.mealGuests ? JSON.parse(metadata.mealGuests) : [];
    mealGuests = Array.isArray(parsedGuests) ? parsedGuests : [];
  } catch {
    mealGuests = [];
  }

  if (slots.length === 0 && mealGuests.length === 0 && !metadata.bookingRef) {
    return null;
  }
  return { slots, mealGuests };
}

/** Marque la réservation en attente comme payée (traçabilité). */
export async function markPendingBookingPaid(bookingRef?: string): Promise<void> {
  if (!bookingRef) return;
  try {
    await adminDB.collection("pendingBookings").doc(bookingRef).update({
      status: "paid",
      updatedAt: admin.firestore.Timestamp.now(),
    });
  } catch {
    /* non bloquant */
  }
}
