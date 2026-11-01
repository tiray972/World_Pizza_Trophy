import { beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { materializeOrderSeats, mealOverview, updateSeat } from "@/lib/server/meals/service";
import { ParticipantActionError } from "@/lib/server/participants/service";
import { resetDb, testDb } from "../helpers/emulator";
import { EVENT_ID, count, seedUser } from "../helpers/fixtures";

const db = testDb();
const admin = { actor: { uid: "admin1", displayName: "Admin WPT" } };
const legacyPayment = (id: string, session: string, guests: object[], quantity: number, createdAt = "2026-10-19T13:55:51Z") =>
  db.collection("payments").doc(id).set({
    eventId: EVENT_ID, userId: "buyer1", stripeSessionId: session, status: "paid", amount: 270, isPack: false,
    metadata: { mealGuests: JSON.stringify(guests), mealQuantity: String(quantity), mealPrice: "30" },
    createdAt: Timestamp.fromDate(new Date(createdAt)),
  });

beforeEach(async () => {
  await resetDb();
  await seedUser(db, "buyer1", { firstName: "User", lastName: "", email: "pizzeria@example.test" });
});

describe("service repas", () => {
  it("vue : session en double comptée une fois, acheteur « User » identifié par son email", async () => {
    const guests = [{ firstName: "GIOVANNI", lastName: "MALTESE" }];
    await legacyPayment("rand1", "cs_dup", guests, 1);
    await legacyPayment("rand2", "cs_dup", guests, 1, "2026-10-19T13:55:52Z");

    const { orders, anomalies } = await mealOverview(db, EVENT_ID);

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ paymentId: "rand1", quantity: 1, buyerLabel: "pizzeria@example.test" });
    expect(anomalies.map(anomaly => anomaly.kind)).toContain("duplicate_payment_record");
  });

  it("matérialisation idempotente ; refusée pour le doublon d'une session", async () => {
    await legacyPayment("fag", "cs_fag", [{ firstName: "Francesco", lastName: "Fagnani" }], 3);
    const first = await materializeOrderSeats(db, "fag", admin);
    const second = await materializeOrderSeats(db, "fag", admin);
    expect(first.created).toBe(3);
    expect(second.created).toBe(0);
    expect(await count(db, "mealSeats")).toBe(3);

    await legacyPayment("rand1", "cs_dup", [{ firstName: "G", lastName: "M" }], 1);
    await legacyPayment("rand2", "cs_dup", [{ firstName: "G", lastName: "M" }], 1, "2026-10-19T13:55:52Z");
    await expect(materializeOrderSeats(db, "rand2", admin)).rejects.toSatisfy(
      (error: unknown) => error instanceof ParticipantActionError && error.code === "duplicate_payment_record"
    );
  });

  it("compléter un bénéficiaire et pointer une présence, avec trace ; pas de pointage d'une place remboursée", async () => {
    await legacyPayment("fag", "cs_fag", [{ firstName: "Francesco", lastName: "Fagnani" }], 3);
    const { seatIds } = await materializeOrderSeats(db, "fag", admin);

    await updateSeat(db, { seatId: seatIds[1], beneficiary: { firstName: "maria", lastName: "fagnani" } }, { ...admin, reason: "Nom donné par l'acheteur" });
    await updateSeat(db, { seatId: seatIds[1], present: true }, admin);
    const seat = (await db.collection("mealSeats").doc(seatIds[1]).get()).data()!;
    expect(seat.beneficiary).toEqual({ firstName: "Maria", lastName: "FAGNANI" });
    expect(seat.attendance.present).toBe(true);
    expect((await db.collection("auditLogs").where("entityId", "==", seatIds[1]).get()).size).toBe(1);

    await db.collection("mealSeats").doc(seatIds[2]).update({ financialStatus: "refunded" });
    await expect(updateSeat(db, { seatId: seatIds[2], present: true }, admin)).rejects.toSatisfy(
      (error: unknown) => error instanceof ParticipantActionError && error.code === "seat_not_paid"
    );
    expect((await db.collection("payments").doc("fag").get()).data()!.amount).toBe(270);
  });
});
