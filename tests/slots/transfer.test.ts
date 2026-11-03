import { beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { transferSlotBooking } from "@/lib/server/slots/transfer";
import { assignSlotsManually } from "@/lib/server/slots/assign";
import { finalizeCheckoutSession } from "@/lib/server/payments/finalize";
import { ParticipantActionError, renameParticipant } from "@/lib/server/participants/service";
import { resetDb, testDb } from "../helpers/emulator";
import { EVENT_ID, paidSession, seedCategory, seedEvent, seedPendingBooking, seedSlot, seedUser } from "../helpers/fixtures";

const db = testDb();
const admin = { actor: { uid: "admin1", displayName: "Admin WPT" } };
const code = (c: string) => (error: unknown) => error instanceof ParticipantActionError && error.code === c;

beforeEach(async () => {
  await resetDb();
  await seedEvent(db);
  await seedCategory(db, "classique");
  await seedCategory(db, "calzone");
  await seedCategory(db, "due", { participantsPerSlot: 2 });
  await seedUser(db, "buyer1");
  for (const id of ["s1", "s2", "s3", "d1", "d2"]) await seedSlot(db, id, id.startsWith("d") ? "due" : id === "s3" ? "calzone" : "classique");
});

async function paidSolo() {
  await db.collection("slots").doc("s1").update({ status: "locked", stripeSessionId: "cs_1" });
  await seedPendingBooking(db, "pb1", { slots: [{ slotId: "s1", participants: [{ firstName: "Kévin", lastName: "PROSPER", shirtSize: "L" }] }], mealGuests: [] });
  return finalizeCheckoutSession(db, paidSession("cs_1", { bookingRef: "pb1", userId: "buyer1", eventId: EVENT_ID, isPack: "false" }, 7000), { source: "webhook" });
}

describe("transfert de créneau", () => {
  it("identité, paiement et statut suivent ; l'ancien créneau redevient vierge", async () => {
    const paid = await paidSolo();
    const result = await transferSlotBooking(db, { sourceSlotId: "s1", targetSlotId: "s2" }, admin);

    expect(result).toMatchObject({ participantIds: paid.participantIds, paymentIds: ["cs_1"] });
    const target = (await db.collection("slots").doc("s2").get()).data()!;
    expect(target).toMatchObject({ status: "paid", buyerId: "buyer1", participantIds: paid.participantIds, stripeSessionId: "cs_1", transferredFromSlotId: "s1" });
    const source = (await db.collection("slots").doc("s1").get()).data()!;
    expect(source.status).toBe("available");
    expect(source.participantIds).toBeUndefined();
    expect(source.participants).toBeUndefined();
    expect(source.buyerId).toBeUndefined();
    expect((await db.collection("payments").doc("cs_1").get()).data()!).toMatchObject({ slotIds: ["s2"], amount: 70 });

    // La correction de nom atteint désormais le créneau transféré.
    await renameParticipant(db, { participantId: paid.participantIds[0], firstName: "Kévin", lastName: "Prosper-Martin" }, admin);
    expect((await db.collection("slots").doc("s2").get()).data()!.participants[0].lastName).toBe("PROSPER-MARTIN");
  });

  it("duo : l'équipe suit le créneau (un seul passage, mêmes membres)", async () => {
    const assigned = await assignSlotsManually(db, {
      eventId: EVENT_ID, requestId: "req-duo-tr1", buyerId: "buyer1", status: "offered",
      assignments: [{ slotId: "d1", participants: [{ firstName: "Marine", lastName: "Briançon" }, { firstName: "Jeremy", lastName: "Chion" }] }],
    }, admin);
    const teamId = assigned.slots[0].teamId!;

    await transferSlotBooking(db, { sourceSlotId: "d1", targetSlotId: "d2" }, admin);

    const team = (await db.collection("teams").doc(teamId).get()).data()!;
    expect(team).toMatchObject({ slotId: "d2", categoryId: "due", status: "complete" });
    expect((await db.collection("slots").doc("d2").get()).data()!).toMatchObject({ teamId, participantIds: assigned.slots[0].participantIds, status: "offered" });
    expect((await db.collection("slots").doc("d1").get()).data()!.teamId).toBeUndefined();
  });

  it("refuse : cible prise, format différent, participant déjà inscrit dans la catégorie cible, édition archivée", async () => {
    const paid = await paidSolo();
    await db.collection("slots").doc("s2").update({ status: "paid", buyerId: "other" });
    await expect(transferSlotBooking(db, { sourceSlotId: "s1", targetSlotId: "s2" }, admin)).rejects.toSatisfy(code("slot_taken"));
    await expect(transferSlotBooking(db, { sourceSlotId: "s1", targetSlotId: "d2" }, admin)).rejects.toSatisfy(code("team_size_mismatch"));

    // Déjà inscrit en Calzone : un transfert vers un autre créneau Calzone est refusé.
    await db.collection("slots").doc("s3").update({ status: "offered", participantIds: paid.participantIds, startTime: Timestamp.fromDate(new Date("2027-10-26T20:00:00Z")) });
    await seedSlot(db, "s4", "calzone");
    await expect(transferSlotBooking(db, { sourceSlotId: "s1", targetSlotId: "s4" }, admin)).rejects.toSatisfy(code("participant_conflict"));

    await db.collection("events").doc(EVENT_ID).update({ status: "archived" });
    await db.collection("slots").doc("s2").update({ status: "available" });
    await expect(transferSlotBooking(db, { sourceSlotId: "s1", targetSlotId: "s2" }, admin)).rejects.toSatisfy(code("event_locked"));
    // Rien n'a bougé.
    expect((await db.collection("slots").doc("s1").get()).data()!.participantIds).toEqual(paid.participantIds);
  });

  it("deux transferts simultanés vers la même cible : un seul aboutit", async () => {
    await paidSolo();
    await assignSlotsManually(db, { eventId: EVENT_ID, requestId: "req-other-01", buyerId: "buyer1", status: "offered", assignments: [{ slotId: "s3", participants: [{ firstName: "Léa", lastName: "Martin" }] }] }, admin);
    await seedSlot(db, "s5", "calzone");
    await db.collection("slots").doc("s5").update({ categoryId: "classique" });
    const attempts = await Promise.allSettled([
      transferSlotBooking(db, { sourceSlotId: "s1", targetSlotId: "s2" }, admin),
      transferSlotBooking(db, { sourceSlotId: "s3", targetSlotId: "s2" }, admin),
    ]);
    expect(attempts.filter(attempt => attempt.status === "fulfilled")).toHaveLength(1);
  });
});
