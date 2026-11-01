import { beforeEach, describe, expect, it } from "vitest";
import { assignSlotsManually, type ManualAssignmentInput } from "@/lib/server/slots/assign";
import { assignBib, ParticipantActionError } from "@/lib/server/participants/service";
import { resetDb, testDb } from "../helpers/emulator";
import { EVENT_ID, count, seedCategory, seedEvent, seedSlot, seedUser } from "../helpers/fixtures";

const db = testDb();
const admin = { actor: { uid: "admin1", displayName: "Admin WPT" } };
const code = (c: string) => (error: unknown) => error instanceof ParticipantActionError && error.code === c;
const marine = { firstName: "Marine", lastName: "Briançon", shirtSize: "S" };
const jeremy = { firstName: "Jeremy", lastName: "Chion", shirtSize: "M" };
const request = (requestId: string, assignments: ManualAssignmentInput["assignments"], extra: Partial<ManualAssignmentInput> = {}): ManualAssignmentInput => ({
  eventId: EVENT_ID, requestId, buyerId: "buyer1", status: "offered", assignments, ...extra,
});

beforeEach(async () => {
  await resetDb();
  await seedEvent(db);
  await seedCategory(db, "classique");
  await seedCategory(db, "calzone");
  await seedCategory(db, "due", { participantsPerSlot: 2, name: "Pizza Due" });
  await seedUser(db, "buyer1");
  await seedUser(db, "buyer2");
  await seedSlot(db, "d1", "due");
  await seedSlot(db, "s1", "classique");
  await seedSlot(db, "s2", "calzone");
});

describe("attribution manuelle", () => {
  it("Pizza Due : les deux équipiers saisis dès l'attribution → une équipe, un créneau, dossard d'équipe distinct", async () => {
    const result = await assignSlotsManually(db, request("req-duo-001", [{ slotId: "d1", participants: [marine, jeremy] }]), admin);

    const slot = (await db.collection("slots").doc("d1").get()).data()!;
    expect(slot).toMatchObject({ status: "offered", buyerId: "buyer1", assignmentType: "manual", assignedByAdminId: "admin1" });
    expect(slot.participants.map((person: { lastName: string }) => person.lastName)).toEqual(["BRIANÇON", "CHION"]);
    expect(slot.participantIds).toHaveLength(2);
    const team = (await db.collection("teams").doc(result.slots[0].teamId!).get()).data()!;
    expect(team).toMatchObject({ categoryId: "due", slotId: "d1", status: "complete", memberIds: slot.participantIds });
    expect(await count(db, "teams")).toBe(1);

    await assignBib(db, { holderType: "participant", holderId: slot.participantIds[0], bib: 16 }, admin);
    await assignBib(db, { holderType: "team", holderId: team ? result.slots[0].teamId! : "", bib: 18 }, admin);
    expect((await db.collection("teams").doc(result.slots[0].teamId!).get()).data()!.bib).toBe(18);
  });

  it("équipe incomplète refusée, sauf choix explicite", async () => {
    await expect(assignSlotsManually(db, request("req-duo-002", [{ slotId: "d1", participants: [marine] }]), admin)).rejects.toSatisfy(code("members_required"));
    expect((await db.collection("slots").doc("d1").get()).data()!.status).toBe("available");
    const result = await assignSlotsManually(db, request("req-duo-003", [{ slotId: "d1", participants: [marine], allowIncomplete: true }]), admin);
    expect((await db.collection("teams").doc(result.slots[0].teamId!).get()).data()!.status).toBe("incomplete");
  });

  it("aucun « payé » inventé : paiement réel de l'acheteur obligatoire, montant inchangé", async () => {
    await expect(assignSlotsManually(db, request("req-paid-01", [{ slotId: "s1", participants: [marine] }], { status: "paid" }), admin)).rejects.toSatisfy(code("payment_required"));
    await db.collection("payments").doc("cs_other").set({ eventId: EVENT_ID, userId: "buyer2", status: "paid", amount: 70, slotIds: [], stripeSessionId: "cs_other" });
    await expect(assignSlotsManually(db, request("req-paid-02", [{ slotId: "s1", participants: [marine] }], { status: "paid", paymentId: "cs_other" }), admin)).rejects.toSatisfy(code("payment_other_buyer"));
    await db.collection("payments").doc("cs_pending").set({ eventId: EVENT_ID, userId: "buyer1", status: "pending", amount: 70, slotIds: [] });
    await expect(assignSlotsManually(db, request("req-paid-03", [{ slotId: "s1", participants: [marine] }], { status: "paid", paymentId: "cs_pending" }), admin)).rejects.toSatisfy(code("payment_invalid"));

    await db.collection("payments").doc("cs_lost").set({ eventId: EVENT_ID, userId: "buyer1", status: "paid", amount: 70, slotIds: [], stripeSessionId: "cs_lost" });
    await assignSlotsManually(db, request("req-paid-04", [{ slotId: "s1", participants: [marine] }], { status: "paid", paymentId: "cs_lost" }), admin);
    expect((await db.collection("slots").doc("s1").get()).data()).toMatchObject({ status: "paid", stripeSessionId: "cs_lost", paymentId: "cs_lost" });
    expect((await db.collection("payments").doc("cs_lost").get()).data()).toMatchObject({ slotIds: ["s1"], amount: 70 });
  });

  it("deux administrateurs sur le même créneau : un seul réussit, rien d'écrasé", async () => {
    const attempts = await Promise.allSettled([
      assignSlotsManually(db, request("req-race-a1", [{ slotId: "s1", participants: [marine] }]), admin),
      assignSlotsManually(db, request("req-race-b1", [{ slotId: "s1", participants: [jeremy] }], { buyerId: "buyer2" }), admin),
    ]);
    expect(attempts.filter(attempt => attempt.status === "fulfilled")).toHaveLength(1);
    expect((attempts.find(attempt => attempt.status === "rejected") as PromiseRejectedResult).reason.code).toBe("slot_taken");
    expect(await count(db, "participants")).toBe(1);
  });

  it("double clic et reprise : même requête rejouée = aucun doublon", async () => {
    const input = request("req-click-01", [{ slotId: "d1", participants: [marine, jeremy] }]);
    const [first, second] = await Promise.all([assignSlotsManually(db, input, admin), assignSlotsManually(db, input, admin)]);
    expect([first.created, second.created].sort()).toEqual([false, true]);
    expect(first.slots).toEqual(second.slots);
    const replay = await assignSlotsManually(db, input, admin);
    expect(replay.created).toBe(false);
    expect(await count(db, "participants")).toBe(2);
    expect(await count(db, "teams")).toBe(1);
  });

  it("un échec n'écrit rien ; la reprise avec une nouvelle requête aboutit", async () => {
    await db.collection("slots").doc("s2").update({ status: "paid", buyerId: "buyer2" });
    await expect(
      assignSlotsManually(db, request("req-fail-01", [{ slotId: "s1", participants: [marine] }, { slotId: "s2", participants: [marine] }]), admin)
    ).rejects.toSatisfy(code("slot_taken"));
    expect((await db.collection("slots").doc("s1").get()).data()!.status).toBe("available");
    expect(await count(db, "participants")).toBe(0);
    await assignSlotsManually(db, request("req-fail-02", [{ slotId: "s1", participants: [marine] }]), admin);
    expect((await db.collection("slots").doc("s1").get()).data()!.status).toBe("offered");
  });

  it("édition terminée ou archivée : refusée", async () => {
    await db.collection("events").doc(EVENT_ID).update({ status: "archived" });
    await expect(assignSlotsManually(db, request("req-arch-01", [{ slotId: "s1", participants: [marine] }]), admin)).rejects.toSatisfy(code("event_locked"));
  });

  it("une même personne : deux créneaux de catégories différentes = une seule identité ; même catégorie = refus", async () => {
    const result = await assignSlotsManually(db, request("req-multi-01", [{ slotId: "s1", participants: [marine] }, { slotId: "s2", participants: [marine] }]), admin);
    expect(result.slots[0].participantIds).toEqual(result.slots[1].participantIds);
    expect(await count(db, "participants")).toBe(1);

    await seedSlot(db, "s3", "classique");
    // Saisie identique du même acheteur : fiche réutilisée, donc déjà inscrite en Classique.
    await expect(assignSlotsManually(db, request("req-multi-02", [{ slotId: "s3", participants: [{ firstName: "MARINE", lastName: "briançon" }] }]), admin)).rejects.toSatisfy(code("participant_conflict"));
    // Par identifiant : même contrôle.
    await expect(assignSlotsManually(db, request("req-multi-03", [{ slotId: "s3", participants: [{ participantId: result.slots[0].participantIds[0] }] }]), admin)).rejects.toSatisfy(code("participant_conflict"));
    // Un autre acheteur saisissant le même nom crée une fiche distincte (aucune fusion) : pas de conflit.
    await assignSlotsManually(db, request("req-multi-04", [{ slotId: "s3", participants: [marine] }], { buyerId: "buyer2" }), admin);
    expect(await count(db, "participants")).toBe(2);
  });

  it("matrice : plusieurs concurrents en une transaction, chacun avec son acheteur", async () => {
    await seedSlot(db, "d2", "due");
    const result = await assignSlotsManually(
      db,
      request("req-matrix-1", [
        { slotId: "s1", participants: [marine], buyerId: "buyer1" },
        { slotId: "d2", participants: [{ firstName: "Léo", lastName: "Fargues" }, { firstName: "Yvan", lastName: "Cotta" }], buyerId: "buyer2" },
      ], { buyerId: null }),
      admin
    );
    expect((await db.collection("slots").doc("s1").get()).data()!.buyerId).toBe("buyer1");
    const duo = (await db.collection("slots").doc("d2").get()).data()!;
    expect(duo).toMatchObject({ buyerId: "buyer2", teamId: result.slots[1].teamId });
    expect(duo.participants.map((person: { lastName: string }) => person.lastName)).toEqual(["FARGUES", "COTTA"]);
  });

  it("participant retiré, créneau d'une autre édition, équipier en double : refusés", async () => {
    await db.collection("participants").doc("rocle").set({ eventId: EVENT_ID, firstName: "Richard", lastName: "ROCLE", withdrawn: true, version: 1 });
    await expect(assignSlotsManually(db, request("req-misc-01", [{ slotId: "d1", participants: [marine, { participantId: "rocle" }] }]), admin)).rejects.toSatisfy(code("participant_withdrawn"));
    await seedSlot(db, "old", "classique", { eventId: "evt2026" });
    await expect(assignSlotsManually(db, request("req-misc-02", [{ slotId: "old", participants: [marine] }]), admin)).rejects.toSatisfy(code("slot_not_found"));
    await expect(assignSlotsManually(db, request("req-misc-03", [{ slotId: "d1", participants: [marine, { ...marine }] }]), admin)).rejects.toSatisfy(code("duplicate_member"));
  });
});
