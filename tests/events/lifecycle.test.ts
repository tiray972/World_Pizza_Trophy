import { beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { changeEventStatus, confirmPricesReviewed, editionReadiness } from "@/lib/server/events/lifecycle";
import { ParticipantActionError } from "@/lib/server/participants/service";
import { finalizeCheckoutSession } from "@/lib/server/payments/finalize";
import { applyRefund } from "@/lib/server/payments/refund";
import { CheckoutError, prepareCheckout } from "@/lib/server/booking/checkout-service";
import { resetDb, testDb } from "../helpers/emulator";
import { EVENT_ID, paidSession, seedCategory, seedEvent, seedPendingBooking, seedSlot, seedUser } from "../helpers/fixtures";

const db = testDb();
const admin = { actor: { uid: "admin1", displayName: "Admin WPT" }, now: new Date("2027-09-01T10:00:00Z") };
const code = (c: string) => (error: unknown) => (error instanceof ParticipantActionError || error instanceof CheckoutError) && error.code === c;

beforeEach(async () => {
  await resetDb();
  await seedEvent(db, { status: "draft", rulesAcceptanceRequired: true });
  await seedCategory(db, "classique", { priceReview: "to_check" });
  await seedSlot(db, "s1", "classique");
  await seedSlot(db, "s2", "classique");
  await seedUser(db, "buyer1");
});

describe("cycle de vie d'une édition", () => {
  it("ouverture refusée tant que les prérequis manquent, puis autorisée et tracée", async () => {
    await expect(changeEventStatus(db, { eventId: EVENT_ID, to: "open", expectedStatus: "draft" }, admin)).rejects.toSatisfy(code("prerequisites_missing"));
    const readiness = await editionReadiness(db, EVENT_ID, admin.now);
    expect(readiness.filter(item => item.required && !item.ok).map(item => item.key).sort()).toEqual(["prices", "rules"]);

    await confirmPricesReviewed(db, EVENT_ID, admin);
    await db.collection("categories").doc("classique").update({ rulesI18n: { published: { version: 1, versionId: "classique_v1", texts: { fr: "Règles" } } } });
    await changeEventStatus(db, { eventId: EVENT_ID, to: "open", expectedStatus: "draft" }, admin);
    expect((await db.collection("events").doc(EVENT_ID).get()).data()!.status).toBe("open");
    const log = (await db.collection("auditLogs").where("action", "==", "event.status").get()).docs[0].data();
    expect(log).toMatchObject({ before: { status: "draft" }, after: { status: "open" }, actorUid: "admin1" });
  });

  it("transitions interdites et modifications concurrentes refusées", async () => {
    await expect(changeEventStatus(db, { eventId: EVENT_ID, to: "archived", expectedStatus: "draft" }, admin)).rejects.toSatisfy(code("transition_refused"));
    await expect(changeEventStatus(db, { eventId: EVENT_ID, to: "open", expectedStatus: "closed" }, admin)).rejects.toSatisfy(code("version_conflict"));
  });

  it("archivage : nouvelles ventes refusées, paiement tardif et remboursement toujours traités, rien supprimé", async () => {
    await db.collection("events").doc(EVENT_ID).update({ status: "completed" });
    await seedPendingBooking(db, "pb1", { slots: [{ slotId: "s1", participants: [{ firstName: "Kévin", lastName: "PROSPER", shirtSize: "L" }] }], mealGuests: [] });
    await db.collection("slots").doc("s1").update({ status: "locked", pendingBookingId: "pb1", lockedUntil: Timestamp.fromDate(new Date("2030-01-01")) });
    await changeEventStatus(db, { eventId: EVENT_ID, to: "archived", expectedStatus: "completed" }, admin);

    await expect(
      prepareCheckout(db, { buyer: { uid: "buyer1", email: "b@x.test" }, eventId: EVENT_ID, slots: [{ slotId: "s2", participants: [{ firstName: "A", lastName: "B", shirtSize: "M" }] }], now: admin.now })
    ).rejects.toSatisfy(code("event_not_open"));

    const late = await finalizeCheckoutSession(db, paidSession("cs_late", { bookingRef: "pb1", userId: "buyer1", eventId: EVENT_ID, isPack: "false" }, 7000), { source: "webhook" });
    expect(late.status).toBe("created");
    expect((await applyRefund(db, { stripeSessionId: "cs_late", amountTotalCents: 7000, amountRefundedCents: 7000 })).status).toBe("applied");
    expect((await db.collection("payments").doc("cs_late").get()).exists).toBe(true);
    expect((await db.collection("slots").doc("s1").get()).data()!.status).toBe("paid");
  });
});
