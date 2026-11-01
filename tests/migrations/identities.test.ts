import { beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { applyIdentityMigration, planIdentityMigration, type BibReference, type MigrationDecisions } from "@/lib/server/migrations/identities";
import { renameParticipant } from "@/lib/server/participants/service";
import { splitDisplayName } from "../../scripts/migrations/references-2026";
import { resetDb, testDb } from "../helpers/emulator";
import { count, seedCategory } from "../helpers/fixtures";

const db = testDb();
const EVENT = "evt2026";
const actor = { uid: "admin1", displayName: "Admin WPT" };

const decisions: MigrationDecisions = {
  renames: [
    { from: { firstName: "Kevin", lastName: "Prospérité" }, to: { firstName: "Kévin", lastName: "PROSPER" }, evidence: "organisateur" },
    { from: { firstName: "Faysal", lastName: "Zari" }, to: { firstName: "Fayzal", lastName: "ZARI" }, evidence: "organisateur" },
  ],
  withdrawn: [{ name: { firstName: "Richard", lastName: "Rocle" }, evidence: "organisateur" }],
  teamDisplayNames: [{ bib: 62, displayName: "FARINA / POULARD", evidence: "résultats" }],
};

const references: BibReference[] = [
  { kind: "individual", bib: 11, names: [{ lastName: "PROSPER", firstName: "Kévin" }], source: "planning" },
  { kind: "individual", bib: 60, names: [{ lastName: "ZARI", firstName: "Fayzal" }], source: "planning" },
  { kind: "individual", bib: 61, names: [{ lastName: "FARINA", firstName: "Gennaro" }], source: "planning" },
  { kind: "individual", bib: 61, names: [{ lastName: "AUTRE", firstName: "Nom" }], source: "ancienne feuille" },
  { kind: "team", bib: 3, names: [{ lastName: "FARGUES", firstName: "Léo" }], source: "planning duo" },
  { kind: "team", bib: 18, names: [{ lastName: "BRIANÇON", firstName: "Marine" }, { lastName: "CHION", firstName: "Jeremy" }], source: "planning duo" },
  { kind: "team", bib: 36, names: [{ lastName: "MATHIOT", firstName: "Maxime" }], source: "planning duo" },
  // Résultats publiés (secondaires) : complètent le duo 3, orthographe différente pour 11.
  { kind: "team", bib: 3, names: [{ lastName: "FARGUES", firstName: "Léo" }, { lastName: "COTTA", firstName: "Yvan" }], source: "résultats", priority: 2 },
  { kind: "individual", bib: 11, names: [{ lastName: "PROSPERE", firstName: "Kevin" }], source: "résultats", priority: 2 },
];

let sequence = 0;
async function slot(id: string, categoryId: string, buyerId: string, participants: object[], status = "paid") {
  const start = new Date(Date.UTC(2026, 9, 27, 9, 0) + sequence++ * 30 * 60000);
  await db.collection("slots").doc(id).set({
    eventId: EVENT, categoryId, date: "2026-10-27", status, buyerId,
    startTime: Timestamp.fromDate(start), endTime: Timestamp.fromDate(new Date(start.getTime() + 900000)),
    participants, participant: participants[0] ?? null, stripeSessionId: `cs_${buyerId}`,
  });
}

beforeEach(async () => {
  await resetDb();
  await seedCategory(db, "classique", { eventId: EVENT });
  await seedCategory(db, "calzone", { eventId: EVENT });
  await seedCategory(db, "due", { eventId: EVENT, participantsPerSlot: 2 });
  const kevin = { firstName: "Kevin", lastName: "Prospérité", shirtSize: "L" };
  await slot("s1", "classique", "buyerA", [kevin]);
  await slot("s2", "calzone", "buyerA", [kevin]);
  await slot("s3", "classique", "buyerB", [kevin], "offered");
  await slot("s4", "classique", "buyerC", [{ firstName: "Faysal", lastName: "Zari" }]);
  await slot("s5", "classique", "buyerD", [{ firstName: "Félix", lastName: "Fournier" }]);
  await slot("s6", "calzone", "buyerE", [{ firstName: "Felix", lastName: "Fournier" }]);
  await slot("d1", "due", "buyerF", [{ firstName: "Alexandre", lastName: "Mazet" }, { firstName: "Richard", lastName: "Rocle" }]);
  await slot("d2", "due", "buyerG", [{ firstName: "Léo", lastName: "Fargues" }]);
  await slot("d3", "due", "buyerH", [{ firstName: "Marine", lastName: "briançon" }, { firstName: "Jeremy", lastName: "Chion" }]);
  await slot("free", "classique", "", [], "available");
  const meta = (guests: object[], quantity: number) => ({ mealGuests: JSON.stringify(guests), mealQuantity: String(quantity), mealPrice: "30" });
  await db.collection("payments").doc("maltese1").set({ eventId: EVENT, userId: "buyerM", stripeSessionId: "cs_dup", status: "paid", amount: 270, isPack: false, metadata: meta([{ firstName: "GIOVANNI", lastName: "MALTESE" }], 1), createdAt: Timestamp.fromDate(new Date("2026-10-19T13:55:51Z")) });
  await db.collection("payments").doc("maltese2").set({ eventId: EVENT, userId: "buyerM", stripeSessionId: "cs_dup", status: "paid", amount: 270, isPack: false, metadata: meta([{ firstName: "GIOVANNI", lastName: "MALTESE" }], 1), createdAt: Timestamp.fromDate(new Date("2026-10-19T13:55:52Z")) });
  await db.collection("payments").doc("fagnani").set({ eventId: EVENT, userId: "buyerN", stripeSessionId: "cs_fag", status: "paid", amount: 90, isPack: false, metadata: meta([{ firstName: "Francesco", lastName: "Fagnani" }], 3), createdAt: Timestamp.fromDate(new Date("2026-10-20T10:00:00Z")) });
});

describe("migration des identités 2026 (simulation puis application)", () => {
  it("simulation : aucune écriture, corrections confirmées appliquées au plan, ambiguïtés signalées", async () => {
    const plan = await planIdentityMigration(db, EVENT, { references, decisions });

    expect(await count(db, "participants")).toBe(0);
    const byName = new Map(plan.participants.map(participant => [`${participant.name.lastName} ${participant.name.firstName}`, participant]));
    // Même nom fautif chez deux acheteurs, confirmé par le dossard unique 11 du planning.
    expect(byName.get("PROSPER Kévin")).toMatchObject({ bib: 11, slotIds: ["s1", "s2", "s3"] });
    expect(byName.get("PROSPER Kévin")!.buyerIds.sort()).toEqual(["buyerA", "buyerB"]);
    expect(byName.get("ZARI Fayzal")).toMatchObject({ bib: 60 });
    expect(byName.get("ROCLE Richard")).toMatchObject({ withdrawn: true });
    // Variantes d'accent : jamais fusionnées.
    expect(byName.has("FOURNIER Félix") && byName.has("FOURNIER Felix")).toBe(true);

    const kinds = plan.issues.map(issue => issue.kind);
    expect(kinds).toEqual(expect.arrayContaining([
      "possible_duplicate", "bib_conflict", "spelling_mismatch", "team_incomplete", "team_unmatched", "withdrawn_still_booked", "duplicate_payment_record", "meal_names_missing",
    ]));
    // Dossard 61 contradictoire entre sources : non attribué.
    expect(plan.participants.some(participant => participant.bib === 61)).toBe(false);

    const teams = new Map(plan.teams.map(team => [team.slotId, team]));
    expect(teams.get("d2")).toMatchObject({ bib: 3, status: "incomplete" });
    expect(plan.issues.find(issue => issue.kind === "team_incomplete" && issue.refs.includes("d2"))!.message).toContain("COTTA Yvan");
    expect(plan.issues.some(issue => issue.kind === "spelling_mismatch" && issue.message.includes("PROSPERE"))).toBe(true);
    expect(teams.get("d3")).toMatchObject({ bib: 18, status: "complete" });
    expect(teams.get("d1")).toMatchObject({ bib: null });
    expect(plan.mealSeats).toEqual(expect.arrayContaining([{ paymentId: "maltese1", seats: 1, named: 1 }, { paymentId: "fagnani", seats: 3, named: 1 }]));
    expect(plan.mealSeats.some(entry => entry.paymentId === "maltese2")).toBe(false);
  });

  it("application : refusée si la base a changé, puis idempotente", async () => {
    const plan = await planIdentityMigration(db, EVENT, { references, decisions });
    await db.collection("slots").doc("free").update({ status: "paid", buyerId: "late", participants: [{ firstName: "Giulia", lastName: "Colonna" }] });
    await expect(applyIdentityMigration(db, EVENT, { references, decisions, fingerprint: plan.fingerprint, actor })).rejects.toThrow(/Empreinte/);

    const fresh = await planIdentityMigration(db, EVENT, { references, decisions });
    await applyIdentityMigration(db, EVENT, { references, decisions, fingerprint: fresh.fingerprint, actor });

    const s1 = (await db.collection("slots").doc("s1").get()).data()!;
    expect(s1.participants[0]).toMatchObject({ firstName: "Kévin", lastName: "PROSPER" });
    expect(s1.participantIds).toHaveLength(1);
    expect((await db.collection("bibs").doc(`${EVENT}_11`).get()).data()!.holderId).toBe(s1.participantIds[0]);
    expect((await db.collection("teams").doc("mig_t_d2").get()).data()).toMatchObject({ bib: 3, status: "incomplete" });
    expect(await count(db, "mealSeats")).toBe(4);
    // Les paiements ne sont pas modifiés.
    expect((await db.collection("payments").doc("maltese2").get()).data()!.mealSeatIds).toBeUndefined();

    const again = await planIdentityMigration(db, EVENT, { references, decisions });
    expect(again.stats.participants).toBe(0);
    expect(again.stats.mealSeats).toBe(0);

    // Après migration, la correction admin s'applique aux données historiques.
    await renameParticipant(db, { participantId: s1.participantIds[0], firstName: "Kévin", lastName: "Prosper" }, { actor });
    expect((await db.collection("slots").doc("s3").get()).data()!.participantIds).toEqual(s1.participantIds);
  });

  it("lit les noms « NOM Prénom » des documents officiels", () => {
    expect(splitDisplayName("BERTEA André")).toEqual({ lastName: "BERTEA", firstName: "André" });
    expect(splitDisplayName("PON LAYUS Alexandre")).toEqual({ lastName: "PON LAYUS", firstName: "Alexandre" });
    expect(splitDisplayName("DE SA Hugo")).toEqual({ lastName: "DE SA", firstName: "Hugo" });
  });
});
