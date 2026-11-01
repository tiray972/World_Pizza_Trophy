// Jeux de données minimaux pour les tests (émulateur uniquement).
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { CheckoutSessionSnapshot } from "@/lib/server/payments/finalize";

export const EVENT_ID = "evt2027";

export async function seedEvent(db: Firestore, overrides: Record<string, unknown> = {}) {
  await db.collection("events").doc(EVENT_ID).set({
    name: "World Pizza Trophy 2027",
    eventYear: 2027,
    status: "open",
    mealPrice: 30,
    minSlotsPerBooking: 1,
    eventStartDate: Timestamp.fromDate(new Date("2027-10-26T08:00:00Z")),
    eventEndDate: Timestamp.fromDate(new Date("2027-10-27T18:00:00Z")),
    registrationDeadline: Timestamp.fromDate(new Date("2027-10-20T22:00:00Z")),
    ...overrides,
  });
}

export async function seedCategory(
  db: Firestore,
  id: string,
  overrides: Record<string, unknown> = {}
) {
  await db.collection("categories").doc(id).set({
    eventId: EVENT_ID,
    name: id,
    description: "",
    unitPrice: 70,
    maxSlots: 20,
    durationMinutes: 15,
    activeDates: ["2027-10-26"],
    isActive: true,
    participantsPerSlot: 1,
    ...overrides,
  });
}

let slotSequence = 0;

/** Chaque créneau créé commence 30 minutes après le précédent (pas de chevauchement). */
export async function seedSlot(
  db: Firestore,
  id: string,
  categoryId: string,
  overrides: Record<string, unknown> = {}
) {
  const start = new Date(Date.UTC(2027, 9, 26, 8, 0) + (slotSequence++ % 40) * 30 * 60000);
  await db.collection("slots").doc(id).set({
    eventId: EVENT_ID,
    categoryId,
    date: "2027-10-26",
    startTime: Timestamp.fromDate(start),
    endTime: Timestamp.fromDate(new Date(start.getTime() + 15 * 60000)),
    status: "available",
    stripeSessionId: null,
    ...overrides,
  });
}

export async function seedUser(db: Firestore, uid: string, overrides: Record<string, unknown> = {}) {
  await db.collection("users").doc(uid).set({
    id: uid,
    firstName: "Acheteur",
    lastName: uid.toUpperCase(),
    email: `${uid}@example.test`,
    role: "user",
    registrations: {},
    ...overrides,
  });
}

export async function seedPendingBooking(
  db: Firestore,
  id: string,
  payload: Record<string, unknown>
) {
  await db.collection("pendingBookings").doc(id).set({ status: "pending", ...payload });
}

export function paidSession(
  id: string,
  metadata: Record<string, string>,
  amountTotal = 20000
): CheckoutSessionSnapshot {
  return { id, paymentStatus: "paid", amountTotal, customerId: "cus_test", metadata, invoice: null };
}

export async function count(db: Firestore, collection: string): Promise<number> {
  return (await db.collection(collection).count().get()).data().count;
}
