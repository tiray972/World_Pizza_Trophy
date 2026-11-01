import { beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { finalizeCheckoutSession } from "@/lib/server/payments/finalize";
import { UNNAMED_PACK_MEAL } from "@/lib/booking/packs";
import { resetDb, testDb } from "../helpers/emulator";
import {
  EVENT_ID,
  count,
  paidSession,
  seedCategory,
  seedEvent,
  seedPendingBooking,
  seedSlot,
  seedUser,
} from "../helpers/fixtures";

const db = testDb();

const kevin = { firstName: "kévin", lastName: "Prosper", shirtSize: "L" };
const marine = { firstName: "Marine", lastName: "briançon", shirtSize: "S" };
const jeremy = { firstName: "JEREMY", lastName: "CHION", shirtSize: "M" };

function metadata(bookingRef: string, extra: Record<string, string> = {}) {
  return {
    bookingRef,
    userId: "buyer1",
    userEmail: "buyer1@example.test",
    eventId: EVENT_ID,
    isPack: "false",
    mealPrice: "30",
    mealQuantity: "0",
    ...extra,
  };
}

beforeEach(async () => {
  await resetDb();
  await seedEvent(db);
  await seedCategory(db, "classique");
  await seedCategory(db, "calzone");
  await seedCategory(db, "due", { participantsPerSlot: 2, name: "Pizza Due" });
  await seedUser(db, "buyer1");
  await seedUser(db, "buyer2");
});

describe("finalizeCheckoutSession", () => {
  it("crée un paiement, des identités, des créneaux payés et une place par repas", async () => {
    await seedSlot(db, "s1", "classique", { status: "locked", stripeSessionId: "cs_1" });
    await seedSlot(db, "s2", "calzone", { status: "locked", stripeSessionId: "cs_1" });
    await seedPendingBooking(db, "pb1", {
      slots: [
        { slotId: "s1", categoryId: "classique", participants: [kevin] },
        { slotId: "s2", categoryId: "calzone", participants: [kevin] },
      ],
      mealGuests: [
        { firstName: "Kévin", lastName: "PROSPER", isParticipant: true },
        { firstName: "Léa", lastName: "Martin" },
      ],
    });

    const result = await finalizeCheckoutSession(
      db,
      paidSession("cs_1", metadata("pb1", { mealQuantity: "2" }), 20000),
      { source: "webhook" }
    );

    expect(result.status).toBe("created");
    expect(result.paymentId).toBe("cs_1");
    expect(result.slotIds).toEqual(["s1", "s2"]);
    // Une seule identité pour la même personne sur deux catégories.
    expect(result.participantIds).toHaveLength(1);
    const participant = (await db.collection("participants").doc(result.participantIds[0]).get()).data()!;
    expect(participant).toMatchObject({ firstName: "Kévin", lastName: "PROSPER", eventId: EVENT_ID, buyerIds: ["buyer1"] });
    expect(participant.enteredAs).toEqual({ firstName: "kévin", lastName: "Prosper" });

    const slot = (await db.collection("slots").doc("s1").get()).data()!;
    expect(slot).toMatchObject({ status: "paid", buyerId: "buyer1", participantIds: result.participantIds });
    expect(slot.lockedUntil).toBeUndefined();

    const seats = await db.collection("mealSeats").where("paymentId", "==", "cs_1").get();
    expect(seats.size).toBe(2);
    const seatData = seats.docs.map(doc => doc.data()).sort((a, b) => a.seatIndex - b.seatIndex);
    expect(seatData[0].beneficiaryParticipantId).toBe(result.participantIds[0]);
    expect(seatData[1].beneficiary).toEqual({ firstName: "Léa", lastName: "MARTIN" });
    expect(seatData.every(seat => seat.financialStatus === "paid" && seat.unitPrice === 30)).toBe(true);

    const user = (await db.collection("users").doc("buyer1").get()).data()!;
    expect(user.registrations[EVENT_ID]).toMatchObject({ paid: true, paymentId: "cs_1" });
    expect(new Set(user.registrations[EVENT_ID].categoryIds)).toEqual(new Set(["classique", "calzone"]));
    expect((await db.collection("pendingBookings").doc("pb1").get()).data()!.status).toBe("paid");
  });

  it("est idempotent : un second appel ne crée rien", async () => {
    await seedSlot(db, "s1", "classique", { status: "locked", stripeSessionId: "cs_1" });
    await seedPendingBooking(db, "pb1", { slots: [{ slotId: "s1", participants: [kevin] }], mealGuests: [] });
    const session = paidSession("cs_1", metadata("pb1"));

    await finalizeCheckoutSession(db, session, { source: "success_page" });
    const second = await finalizeCheckoutSession(db, session, { source: "webhook" });

    expect(second.status).toBe("already_finalized");
    expect(await count(db, "payments")).toBe(1);
    expect(await count(db, "participants")).toBe(1);
  });

  it("webhook et page de succès simultanés : un seul paiement, une seule série de places", async () => {
    await seedSlot(db, "s1", "classique", { status: "locked", stripeSessionId: "cs_1" });
    await seedPendingBooking(db, "pb1", {
      slots: [{ slotId: "s1", participants: [kevin] }],
      mealGuests: [{ firstName: "Giovanni", lastName: "Maltese" }],
    });
    const session = paidSession("cs_1", metadata("pb1", { mealQuantity: "1" }));

    const results = await Promise.all(
      ["webhook", "success_page", "recovery", "webhook", "success_page"].map(source =>
        finalizeCheckoutSession(db, session, { source: source as "webhook" })
      )
    );

    expect(results.filter(result => result.status === "created")).toHaveLength(1);
    expect(results.filter(result => result.status === "already_finalized")).toHaveLength(4);
    expect(await count(db, "payments")).toBe(1);
    expect(await count(db, "mealSeats")).toBe(1);
    expect(await count(db, "participants")).toBe(1);
  });

  it("reconnaît un paiement enregistré par l'ancien code (identifiant aléatoire)", async () => {
    await seedSlot(db, "s1", "classique", { status: "paid", stripeSessionId: "cs_1" });
    await seedPendingBooking(db, "pb1", { slots: [{ slotId: "s1", participants: [kevin] }], mealGuests: [] });
    await db.collection("payments").doc("random123").set({ stripeSessionId: "cs_1", status: "paid" });

    const result = await finalizeCheckoutSession(db, paidSession("cs_1", metadata("pb1")), { source: "webhook" });

    expect(result).toMatchObject({ status: "already_finalized", paymentId: "random123" });
    expect(await count(db, "payments")).toBe(1);
    expect(await count(db, "participants")).toBe(0);
  });

  it("n'écrase jamais un créneau pris par un autre acheteur : conflit tracé, participant conservé", async () => {
    await seedSlot(db, "s1", "classique", { status: "paid", stripeSessionId: "cs_other", buyerId: "buyer2" });
    await seedSlot(db, "s2", "calzone", { status: "locked", stripeSessionId: "cs_1" });
    await seedPendingBooking(db, "pb1", {
      slots: [
        { slotId: "s1", participants: [kevin] },
        { slotId: "s2", participants: [kevin] },
      ],
      mealGuests: [],
    });

    const result = await finalizeCheckoutSession(db, paidSession("cs_1", metadata("pb1")), { source: "webhook" });

    expect(result.status).toBe("created");
    expect(result.slotIds).toEqual(["s2"]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({ slotId: "s1", reason: "taken_by_other", currentSessionId: "cs_other" }),
    ]);
    expect((await db.collection("slots").doc("s1").get()).data()).toMatchObject({ buyerId: "buyer2", stripeSessionId: "cs_other" });
    const payment = (await db.collection("payments").doc("cs_1").get()).data()!;
    expect(payment.needsReview).toBe(true);
    expect((await db.collection("paymentIncidents").doc("cs_1").get()).data()!.reason).toBe("slot_conflict");
    expect(await count(db, "participants")).toBe(1);
  });

  it("accepte un créneau dont le verrou d'un autre acheteur a expiré", async () => {
    await seedSlot(db, "s1", "classique", {
      status: "locked",
      stripeSessionId: "cs_old",
      lockedByUserId: "buyer2",
      lockedUntil: Timestamp.fromDate(new Date("2027-01-01T00:00:00Z")),
    });
    await seedPendingBooking(db, "pb1", { slots: [{ slotId: "s1", participants: [kevin] }], mealGuests: [] });

    const result = await finalizeCheckoutSession(db, paidSession("cs_1", metadata("pb1")), {
      source: "webhook",
      now: new Date("2027-02-01T00:00:00Z"),
    });

    expect(result.slotIds).toEqual(["s1"]);
    expect(result.conflicts).toEqual([]);
  });

  it("crée une équipe unique pour un duo, complète ou incomplète", async () => {
    await seedSlot(db, "d1", "due", { status: "locked", stripeSessionId: "cs_1" });
    await seedSlot(db, "d2", "due", { status: "locked", stripeSessionId: "cs_1" });
    await seedPendingBooking(db, "pb1", {
      slots: [
        { slotId: "d1", participants: [marine, jeremy] },
        { slotId: "d2", participants: [kevin] },
      ],
      mealGuests: [],
    });

    const result = await finalizeCheckoutSession(db, paidSession("cs_1", metadata("pb1")), { source: "webhook" });

    expect(result.teamIds).toHaveLength(2);
    const complete = (await db.collection("teams").doc("cs_1_t_d1").get()).data()!;
    expect(complete).toMatchObject({ categoryId: "due", slotId: "d1", requiredMembers: 2, status: "complete" });
    expect(complete.memberIds).toHaveLength(2);
    const incomplete = (await db.collection("teams").doc("cs_1_t_d2").get()).data()!;
    expect(incomplete.status).toBe("incomplete");
    expect((await db.collection("slots").doc("d1").get()).data()!.teamId).toBe("cs_1_t_d1");
  });

  it("pack : repas inclus sans nom = places à compléter, jamais le nom de l'acheteur", async () => {
    await seedSlot(db, "s1", "classique", { status: "locked", stripeSessionId: "cs_1" });
    await seedPendingBooking(db, "pb1", {
      slots: [{ slotId: "s1", participants: [kevin] }],
      mealGuests: [{ ...UNNAMED_PACK_MEAL }, { ...UNNAMED_PACK_MEAL }],
    });

    await finalizeCheckoutSession(
      db,
      paidSession("cs_1", metadata("pb1", { isPack: "true", packId: "p1", packName: "Pack Or", mealPrice: "0", mealQuantity: "2" })),
      { source: "webhook" }
    );

    const seats = (await db.collection("mealSeats").get()).docs.map(doc => doc.data());
    expect(seats).toHaveLength(2);
    expect(seats.every(seat => seat.beneficiary === null && seat.includedInPack && seat.unitPrice === null)).toBe(true);
  });

  it("conserve le nombre de places payées même si moins de noms ont été transmis", async () => {
    await seedPendingBooking(db, "pb1", {
      slots: [],
      mealGuests: [{ firstName: "Francesco", lastName: "Fagnani" }],
    });

    await finalizeCheckoutSession(db, paidSession("cs_1", metadata("pb1", { mealQuantity: "3" }), 9000), { source: "webhook" });

    const seats = (await db.collection("mealSeats").get()).docs.map(doc => doc.data());
    expect(seats).toHaveLength(3);
    expect(seats.filter(seat => seat.beneficiary === null)).toHaveLength(2);
  });

  it("charge utile introuvable : incident enregistré, aucun paiement inventé", async () => {
    const result = await finalizeCheckoutSession(db, paidSession("cs_1", metadata("absent")), { source: "webhook" });

    expect(result.status).toBe("payload_missing");
    expect(await count(db, "payments")).toBe(0);
    expect((await db.collection("paymentIncidents").doc("cs_1").get()).data()!.reason).toBe("payload_missing");
  });

  it("ne fusionne pas sur un nom proche ni entre acheteurs différents", async () => {
    await seedSlot(db, "s1", "classique", { status: "locked", stripeSessionId: "cs_1" });
    await seedSlot(db, "s2", "calzone", { status: "locked", stripeSessionId: "cs_2" });
    await seedSlot(db, "s3", "classique", { status: "locked", stripeSessionId: "cs_3" });
    await seedPendingBooking(db, "pb1", { slots: [{ slotId: "s1", participants: [kevin] }], mealGuests: [] });
    await seedPendingBooking(db, "pb2", {
      slots: [{ slotId: "s2", participants: [{ ...kevin, firstName: "Kevin" }] }],
      mealGuests: [],
    });
    await seedPendingBooking(db, "pb3", { slots: [{ slotId: "s3", participants: [kevin] }], mealGuests: [] });

    const first = await finalizeCheckoutSession(db, paidSession("cs_1", metadata("pb1")), { source: "webhook" });
    // Même acheteur, accent différent : identité distincte (signalée, pas fusionnée).
    const second = await finalizeCheckoutSession(db, paidSession("cs_2", metadata("pb2")), { source: "webhook" });
    // Acheteur différent, nom identique : identité distincte.
    const third = await finalizeCheckoutSession(
      db,
      paidSession("cs_3", metadata("pb3", { userId: "buyer2" })),
      { source: "webhook" }
    );

    expect(new Set([first.participantIds[0], second.participantIds[0], third.participantIds[0]]).size).toBe(3);
  });

  it("même acheteur, même saisie exacte dans une commande suivante : même identité", async () => {
    await seedSlot(db, "s1", "classique", { status: "locked", stripeSessionId: "cs_1" });
    await seedSlot(db, "s2", "calzone", { status: "locked", stripeSessionId: "cs_2" });
    await seedPendingBooking(db, "pb1", { slots: [{ slotId: "s1", participants: [kevin] }], mealGuests: [] });
    await seedPendingBooking(db, "pb2", {
      slots: [{ slotId: "s2", participants: [{ ...kevin, firstName: "KÉVIN" }] }],
      mealGuests: [],
    });

    const first = await finalizeCheckoutSession(db, paidSession("cs_1", metadata("pb1")), { source: "webhook" });
    const second = await finalizeCheckoutSession(db, paidSession("cs_2", metadata("pb2")), { source: "webhook" });

    expect(second.participantIds).toEqual(first.participantIds);
    expect(await count(db, "participants")).toBe(1);
  });

  it("ignore une session non payée", async () => {
    const result = await finalizeCheckoutSession(
      db,
      { ...paidSession("cs_1", metadata("pb1")), paymentStatus: "unpaid" },
      { source: "success_page" }
    );
    expect(result.status).toBe("not_paid");
    expect(await count(db, "payments")).toBe(0);
  });
});
