import { beforeEach, describe, expect, it } from "vitest";
import { finalizeCheckoutSession } from "@/lib/server/payments/finalize";
import {
  assignBib,
  createParticipant,
  ParticipantActionError,
  renameParticipant,
  setTeamMembers,
  setWithdrawn,
} from "@/lib/server/participants/service";
import { resetDb, testDb } from "../helpers/emulator";
import { EVENT_ID, count, paidSession, seedCategory, seedEvent, seedPendingBooking, seedSlot, seedUser } from "../helpers/fixtures";

const db = testDb();
const admin = { actor: { uid: "admin1", displayName: "Admin WPT" } };

async function expectActionError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((error: unknown) => error instanceof ParticipantActionError && error.code === code);
}

/** Commande réelle : un acheteur inscrit « PROSPÉRITÉ Kevin » sur deux catégories avec son repas. */
async function bookProsperite() {
  await seedSlot(db, "s1", "classique", { status: "locked", stripeSessionId: "cs_1" });
  await seedSlot(db, "s2", "calzone", { status: "locked", stripeSessionId: "cs_1" });
  await seedPendingBooking(db, "pb1", {
    slots: [
      { slotId: "s1", participants: [{ firstName: "Kevin", lastName: "Prospérité", shirtSize: "L" }] },
      { slotId: "s2", participants: [{ firstName: "Kevin", lastName: "Prospérité", shirtSize: "L" }] },
    ],
    mealGuests: [{ firstName: "Kevin", lastName: "Prospérité", isParticipant: true }],
  });
  const result = await finalizeCheckoutSession(
    db,
    paidSession("cs_1", { bookingRef: "pb1", userId: "buyer1", eventId: EVENT_ID, isPack: "false", mealPrice: "30", mealQuantity: "1" }, 16000),
    { source: "webhook" }
  );
  return result.participantIds[0];
}

beforeEach(async () => {
  await resetDb();
  await seedEvent(db);
  await seedCategory(db, "classique");
  await seedCategory(db, "calzone");
  await seedCategory(db, "due", { participantsPerSlot: 2 });
  await seedUser(db, "buyer1");
});

describe("correction de nom après paiement", () => {
  it("propage le nom corrigé sans perdre identifiant, créneaux, repas ni paiement", async () => {
    const id = await bookProsperite();
    const paymentBefore = (await db.collection("payments").doc("cs_1").get()).data();

    const result = await renameParticipant(db, { participantId: id, firstName: "Kévin", lastName: "Prosper", expectedVersion: 1 }, { ...admin, reason: "Saisie fautive confirmée" });

    expect(result).toMatchObject({ participantId: id, version: 2, after: { firstName: "Kévin", lastName: "PROSPER" }, updated: { slots: 2, mealSeats: 1 } });
    for (const slotId of ["s1", "s2"]) {
      const slot = (await db.collection("slots").doc(slotId).get()).data()!;
      expect(slot.participantIds).toEqual([id]);
      expect(slot.participants[0]).toMatchObject({ firstName: "Kévin", lastName: "PROSPER", shirtSize: "L" });
      expect(slot.status).toBe("paid");
      expect(slot.stripeSessionId).toBe("cs_1");
    }
    const seat = (await db.collection("mealSeats").where("beneficiaryParticipantId", "==", id).get()).docs[0].data();
    expect(seat.beneficiary).toEqual({ firstName: "Kévin", lastName: "PROSPER" });
    // La pièce comptable n'est pas réécrite.
    expect((await db.collection("payments").doc("cs_1").get()).data()).toEqual(paymentBefore);

    const log = (await db.collection("auditLogs").where("entityId", "==", id).get()).docs[0].data();
    expect(log).toMatchObject({
      action: "participant.rename",
      actorUid: "admin1",
      before: { firstName: "Kevin", lastName: "PROSPÉRITÉ" },
      after: { firstName: "Kévin", lastName: "PROSPER" },
      reason: "Saisie fautive confirmée",
    });
  });

  it("refuse une correction concurrente basée sur une version périmée", async () => {
    const id = await bookProsperite();
    await renameParticipant(db, { participantId: id, firstName: "Kévin", lastName: "Prosper", expectedVersion: 1 }, admin);
    await expectActionError(
      renameParticipant(db, { participantId: id, firstName: "Kevin", lastName: "Prosper", expectedVersion: 1 }, admin),
      "version_conflict"
    );
    expect((await db.collection("participants").doc(id).get()).data()!.firstName).toBe("Kévin");
  });

  it("respecte accents, apostrophes et noms composés", async () => {
    const id = await bookProsperite();
    const result = await renameParticipant(db, { participantId: id, firstName: "jean-françois", lastName: "d'agostino  della  rovere" }, admin);
    expect(result.after).toEqual({ firstName: "Jean-François", lastName: "D'AGOSTINO DELLA ROVERE" });
  });

  it("refuse un nom vide", async () => {
    const id = await bookProsperite();
    await expectActionError(renameParticipant(db, { participantId: id, firstName: " ", lastName: "PROSPER" }, admin), "name_required");
  });
});

describe("dossards", () => {
  it("attribue un numéro unique dans l'édition, refuse une collision sans réattribuer", async () => {
    const kevin = await bookProsperite();
    const zari = (await createParticipant(db, { eventId: EVENT_ID, firstName: "Fayzal", lastName: "Zari", requestId: "req-zari-01" }, admin)).participantId;

    await assignBib(db, { holderType: "participant", holderId: kevin, bib: 11 }, admin);
    await expectActionError(assignBib(db, { holderType: "participant", holderId: zari, bib: 11 }, admin), "bib_taken");
    expect((await db.collection("participants").doc(kevin).get()).data()!.bib).toBe(11);

    // Changement explicite : l'ancien numéro est libéré.
    await assignBib(db, { holderType: "participant", holderId: kevin, bib: 12 }, admin);
    await assignBib(db, { holderType: "participant", holderId: zari, bib: 11 }, admin);
    expect((await db.collection("bibs").doc(`${EVENT_ID}_11`).get()).data()!.holderId).toBe(zari);
  });

  it("collision simultanée : un seul porteur", async () => {
    const ids = await Promise.all(
      ["a", "b", "c"].map(async (suffix, index) =>
        (await createParticipant(db, { eventId: EVENT_ID, firstName: "Test", lastName: `Nom${index}`, requestId: `req-bib-${suffix}-000` }, admin)).participantId
      )
    );
    const attempts = await Promise.allSettled(ids.map(id => assignBib(db, { holderType: "participant", holderId: id, bib: 60 }, admin)));
    expect(attempts.filter(attempt => attempt.status === "fulfilled")).toHaveLength(1);
    expect(await count(db, "bibs")).toBe(1);
  });

  it("un duo a son propre numéro, distinct de ceux de ses membres", async () => {
    await seedSlot(db, "d1", "due", { status: "locked", stripeSessionId: "cs_d" });
    await seedPendingBooking(db, "pbd", {
      slots: [{ slotId: "d1", participants: [{ firstName: "Marine", lastName: "Briançon", shirtSize: "S" }, { firstName: "Jeremy", lastName: "Chion", shirtSize: "M" }] }],
      mealGuests: [],
    });
    const result = await finalizeCheckoutSession(db, paidSession("cs_d", { bookingRef: "pbd", userId: "buyer1", eventId: EVENT_ID, isPack: "false" }), { source: "webhook" });
    await assignBib(db, { holderType: "participant", holderId: result.participantIds[0], bib: 5 }, admin);
    await assignBib(db, { holderType: "team", holderId: result.teamIds[0], bib: 18 }, admin);
    await expectActionError(assignBib(db, { holderType: "team", holderId: result.teamIds[0], bib: 5 }, admin), "bib_taken");
    expect((await db.collection("teams").doc(result.teamIds[0]).get()).data()!.bib).toBe(18);
  });
});

describe("équipes Pizza Due", () => {
  it("compléter un équipier manquant : même créneau, même paiement, équipe complète", async () => {
    await seedSlot(db, "d1", "due", { status: "locked", stripeSessionId: "cs_d" });
    await seedPendingBooking(db, "pbd", {
      slots: [{ slotId: "d1", participants: [{ firstName: "Léo", lastName: "Fargues", shirtSize: "M" }] }],
      mealGuests: [],
    });
    // Chemin historique : un duo payé avec un seul nom.
    await db.collection("categories").doc("due").update({ participantsPerSlot: 2 });
    const finalized = await finalizeCheckoutSession(db, paidSession("cs_d", { bookingRef: "pbd", userId: "buyer1", eventId: EVENT_ID, isPack: "false" }), { source: "webhook" });
    const teamId = finalized.teamIds[0];
    expect((await db.collection("teams").doc(teamId).get()).data()!.status).toBe("incomplete");

    const cotta = (await createParticipant(db, { eventId: EVENT_ID, firstName: "Yvan", lastName: "Cotta", requestId: "req-cotta-01" }, admin)).participantId;
    const result = await setTeamMembers(db, { teamId, memberIds: [finalized.participantIds[0], cotta], expectedVersion: 1 }, { ...admin, reason: "Résultat officiel FARGUES Léo - COTTA Yvan" });

    expect(result.status).toBe("complete");
    const slot = (await db.collection("slots").doc("d1").get()).data()!;
    expect(slot.participantIds).toEqual([finalized.participantIds[0], cotta]);
    expect(slot.participants.map((participant: { lastName: string }) => participant.lastName)).toEqual(["FARGUES", "COTTA"]);
    expect(slot).toMatchObject({ status: "paid", stripeSessionId: "cs_d", teamId });
    expect(await count(db, "teams")).toBe(1);
    expect(await count(db, "payments")).toBe(1);
  });

  it("refuse un équipier d'une autre édition ou en double", async () => {
    await seedSlot(db, "d1", "due", { status: "locked", stripeSessionId: "cs_d" });
    await seedPendingBooking(db, "pbd", { slots: [{ slotId: "d1", participants: [{ firstName: "Léo", lastName: "Fargues", shirtSize: "M" }] }], mealGuests: [] });
    const finalized = await finalizeCheckoutSession(db, paidSession("cs_d", { bookingRef: "pbd", userId: "buyer1", eventId: EVENT_ID, isPack: "false" }), { source: "webhook" });
    await db.collection("participants").doc("other").set({ eventId: "evt2026", firstName: "X", lastName: "Y", version: 1 });
    await expectActionError(setTeamMembers(db, { teamId: finalized.teamIds[0], memberIds: [finalized.participantIds[0], "other"] }, admin), "member_other_event");
    await expectActionError(
      setTeamMembers(db, { teamId: finalized.teamIds[0], memberIds: [finalized.participantIds[0], finalized.participantIds[0]] }, admin),
      "duplicate_member"
    );
  });
});

describe("ajout et retrait", () => {
  it("double clic sur « ajouter » : une seule fiche", async () => {
    const input = { eventId: EVENT_ID, firstName: "Sébastien", lastName: "Pouvreau", requestId: "req-pouvreau-1" };
    const [first, second] = await Promise.all([createParticipant(db, input, admin), createParticipant(db, input, admin)]);
    expect(first.participantId).toBe(second.participantId);
    expect(await count(db, "participants")).toBe(1);
  });

  it("retirer du planning ne supprime ni la fiche ni le paiement", async () => {
    const id = await bookProsperite();
    await setWithdrawn(db, { participantId: id, withdrawn: true }, { ...admin, reason: "Retiré du planning" });
    expect((await db.collection("participants").doc(id).get()).data()!.withdrawn).toBe(true);
    expect((await db.collection("payments").doc("cs_1").get()).exists).toBe(true);
  });
});
