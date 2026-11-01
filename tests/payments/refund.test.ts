import { beforeEach, describe, expect, it } from "vitest";
import { applyRefund } from "@/lib/server/payments/refund";
import { finalizeCheckoutSession } from "@/lib/server/payments/finalize";
import { resetDb, testDb } from "../helpers/emulator";
import { EVENT_ID, paidSession, seedCategory, seedEvent, seedPendingBooking, seedSlot, seedUser } from "../helpers/fixtures";

const db = testDb();

beforeEach(async () => {
  await resetDb();
  await seedEvent(db);
  await seedCategory(db, "classique");
  await seedUser(db, "buyer1");
  await seedSlot(db, "s1", "classique", { status: "locked", stripeSessionId: "cs_1" });
  await seedPendingBooking(db, "pb1", {
    slots: [{ slotId: "s1", participants: [{ firstName: "Kévin", lastName: "PROSPER", shirtSize: "L" }] }],
    mealGuests: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Paul", lastName: "Martin" }],
  });
  await finalizeCheckoutSession(
    db,
    paidSession("cs_1", { bookingRef: "pb1", userId: "buyer1", eventId: EVENT_ID, isPack: "false", mealPrice: "30", mealQuantity: "2" }, 13000),
    { source: "webhook" }
  );
});

describe("applyRefund", () => {
  it("remboursement total : paiement et places repas remboursés, créneau conservé, trace écrite", async () => {
    const result = await applyRefund(db, { stripeSessionId: "cs_1", amountTotalCents: 13000, amountRefundedCents: 13000, chargeId: "ch_1" });

    expect(result).toMatchObject({ status: "applied", fullRefund: true });
    expect((await db.collection("payments").doc("cs_1").get()).data()).toMatchObject({ status: "refunded", amountRefunded: 130, needsReview: true });
    const seats = (await db.collection("mealSeats").get()).docs.map(doc => doc.data().financialStatus);
    expect(seats).toEqual(["refunded", "refunded"]);
    expect((await db.collection("slots").doc("s1").get()).data()!.status).toBe("paid");
    const audit = await db.collection("auditLogs").where("entityId", "==", "cs_1").get();
    expect(audit.docs[0].data().action).toBe("refund.full");
  });

  it("remboursement partiel : montant tracé, places inchangées, décision laissée à l'admin", async () => {
    await applyRefund(db, { stripeSessionId: "cs_1", amountTotalCents: 13000, amountRefundedCents: 3000 });
    expect((await db.collection("payments").doc("cs_1").get()).data()).toMatchObject({ status: "paid", amountRefunded: 30, needsReview: true });
    const seats = (await db.collection("mealSeats").get()).docs.map(doc => doc.data().financialStatus);
    expect(seats).toEqual(["paid", "paid"]);
  });

  it("événement Stripe rejoué : aucun changement supplémentaire", async () => {
    await applyRefund(db, { stripeSessionId: "cs_1", amountTotalCents: 13000, amountRefundedCents: 13000 });
    const again = await applyRefund(db, { stripeSessionId: "cs_1", amountTotalCents: 13000, amountRefundedCents: 13000 });
    expect(again.status).toBe("unchanged");
    expect((await db.collection("auditLogs").get()).size).toBe(1);
  });

  it("remboursement sans paiement connu : incident à traiter", async () => {
    const result = await applyRefund(db, { stripeSessionId: "cs_unknown", amountTotalCents: 5000, amountRefundedCents: 5000 });
    expect(result.status).toBe("payment_not_found");
    expect((await db.collection("paymentIncidents").doc("refund_cs_unknown").get()).exists).toBe(true);
  });
});
