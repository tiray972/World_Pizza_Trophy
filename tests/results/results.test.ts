import { beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { parseResultsCsv, resultExports, type ResultLine } from "@/lib/domain/results";
import { publicResults, publishResultSet, resultsOfParticipant, saveResultDraft, validateResultSet } from "@/lib/server/results/service";
import { ParticipantActionError, renameParticipant } from "@/lib/server/participants/service";
import { resetDb, testDb } from "../helpers/emulator";

const db = testDb();
const admin = { actor: { uid: "admin1", displayName: "Admin WPT" } };
const EVENT = "evt2026";
const code = (c: string) => (error: unknown) => error instanceof ParticipantActionError && error.code === c;
const line = (rank: number | null, bib: number | null, name: string, points: number | null, status: ResultLine["status"] = "ranked"): ResultLine => ({ rank, bib, name, points, status });

async function person(id: string, firstName: string, lastName: string, bib: number | null) {
  await db.collection("participants").doc(id).set({ eventId: EVENT, firstName, lastName, bib, version: 1, withdrawn: false });
}

beforeEach(async () => {
  await resetDb();
  await db.collection("events").doc(EVENT).set({ name: "WPT 2026", status: "completed" });
  await person("bertea", "André", "BERTEA", 10);
  await person("prosper", "Kevin", "PROSPÉRITÉ", 11);
  await person("martinez", "Guillaume", "MARTINEZ", 52);
  await person("marine", "Marine", "BRIANÇON", 16);
  await person("jeremy", "Jeremy", "CHION", null);
  await person("dupont1", "Paul", "DUPONT", null);
  await person("dupont2", "Paul", "DUPONT", null);
  for (const [id, categoryId, ids] of [["s1", "classique", ["bertea"]], ["s2", "classique", ["prosper"]], ["s3", "classique", ["martinez"]], ["d1", "due", ["marine", "jeremy"]]] as const) {
    await db.collection("slots").doc(id).set({ eventId: EVENT, categoryId, status: "paid", participantIds: ids, startTime: Timestamp.now() });
  }
  await db.collection("teams").doc("t18").set({ eventId: EVENT, categoryId: "due", slotId: "d1", memberIds: ["marine", "jeremy"], bib: 18, status: "complete", requiredMembers: 2 });
});

const classique = (lines: ResultLine[], extra = {}) =>
  saveResultDraft(db, { eventId: EVENT, categoryKey: "classique", categoryId: "classique", categoryName: "Classique", kind: "individual", lines, source: "test", ...extra }, admin);

describe("résultats", () => {
  it("rapproche par dossard ; nom différent, inconnu ou ambigu : bloquant jusqu'à confirmation", async () => {
    const draft = await classique([
      line(1, 11, "PROSPER Kévin", 600),
      line(2, 52, "MARTINNEZ Guillaume", 550),
      line(3, 99, "INCONNU Jean", 500),
      line(4, null, "DUPONT Paul", 450),
      line(5, 10, "BERTEA André", 385),
    ]);
    const byName = new Map(draft.lines.map(entry => [entry.name, entry]));
    expect(byName.get("BERTEA André")).toMatchObject({ match: "bib", holderId: "bertea" });
    expect(byName.get("MARTINNEZ Guillaume")).toMatchObject({ match: "bib_name_mismatch", holderId: "martinez" });
    expect(byName.get("INCONNU Jean")!.holderId).toBeNull();
    expect(byName.get("DUPONT Paul")!.holderId).toBeNull();
    expect(draft.blocking.length).toBeGreaterThanOrEqual(4);

    const set = (await db.collection("resultSets").doc(`${EVENT}_classique`).get()).data()!;
    await expect(validateResultSet(db, { id: `${EVENT}_classique`, expectedDraftVersion: set.draftVersion }, admin)).rejects.toSatisfy(code("blocking_issues"));
  });

  it("brouillon invisible ; publication après validation ; correction tracée ; nom corrigé reflété", async () => {
    await classique([line(1, 11, "PROSPÉRITÉ Kevin", 600), line(2, 10, "BERTEA André", 385)]);
    expect(await publicResults(db, EVENT)).toEqual([]);
    await expect(publishResultSet(db, { id: `${EVENT}_classique` }, admin)).rejects.toSatisfy(code("not_validated"));

    await validateResultSet(db, { id: `${EVENT}_classique`, expectedDraftVersion: 1 }, admin);
    await publishResultSet(db, { id: `${EVENT}_classique` }, admin);
    let published = await publicResults(db, EVENT);
    expect(published[0].lines.map(entry => [entry.rank, entry.name])).toEqual([[1, "PROSPÉRITÉ Kevin"], [2, "BERTEA André"]]);

    // Correction d'identité : la page publique suit sans republier.
    await renameParticipant(db, { participantId: "prosper", firstName: "Kévin", lastName: "Prosper" }, admin);
    published = await publicResults(db, EVENT);
    expect(published[0].lines[0].name).toBe("PROSPER Kévin");

    // Correction du classement : nouvelle version, l'ancienne est conservée.
    await classique([line(1, 10, "BERTEA André", 610), line(2, 11, "PROSPER Kévin", 600)]);
    expect((await publicResults(db, EVENT))[0].lines[0].name).toBe("PROSPER Kévin");
    await validateResultSet(db, { id: `${EVENT}_classique`, expectedDraftVersion: 2 }, admin);
    await publishResultSet(db, { id: `${EVENT}_classique` }, { ...admin, reason: "Feuille officielle corrigée" });
    expect((await publicResults(db, EVENT))[0]).toMatchObject({ version: 2 });
    expect((await db.collection("resultRevisions").doc(`${EVENT}_classique_v1`).get()).exists).toBe(true);
    const actions = (await db.collection("auditLogs").where("entity", "==", "result").get()).docs.map(doc => doc.data().action).sort();
    expect(actions).toEqual(["results.correct", "results.publish"]);
  });

  it("ex æquo et points égaux : ordre officiel conservé, signalé, jamais recalculé ; statuts ≠ dernière place", async () => {
    const draft = await classique([line(1, 11, "PROSPÉRITÉ Kevin", 600), line(2, 10, "BERTEA André", 600), line(null, 52, "MARTINEZ Guillaume", null, "dsq")]);
    expect(draft.lines.map(entry => entry.name)).toEqual(["PROSPÉRITÉ Kevin", "BERTEA André", "MARTINEZ Guillaume"]);
    expect(draft.warnings.some(warning => warning.includes("aucun départage"))).toBe(true);
    expect(draft.lines[2]).toMatchObject({ rank: null, status: "dsq", points: null });
    const exported = resultExports(draft.lines);
    expect(exported.podium.map(entry => entry.name)).toEqual(["PROSPÉRITÉ Kevin", "BERTEA André"]);
    expect(exported.top10).toBeNull();
  });

  it("Pizza Due : un seul résultat d'équipe, visible pour ses deux membres", async () => {
    await saveResultDraft(db, { eventId: EVENT, categoryKey: "chef-ziolo", categoryId: "due", categoryName: "Trophée Chef'Ziolo", kind: "team", lines: [line(1, 18, "BRIANCON Marine - CHION Jeremy", 738)], source: "test" }, admin);
    await validateResultSet(db, { id: `${EVENT}_chef-ziolo`, expectedDraftVersion: 1 }, admin);
    await publishResultSet(db, { id: `${EVENT}_chef-ziolo` }, admin);
    const [set] = await publicResults(db, EVENT);
    expect(set.lines).toHaveLength(1);
    expect(set.lines[0].members).toEqual(["BRIANÇON Marine", "CHION Jeremy"]);
    for (const member of ["marine", "jeremy"]) {
      expect(await resultsOfParticipant(db, EVENT, member)).toEqual([expect.objectContaining({ rank: 1, points: 738, categoryName: "Trophée Chef'Ziolo" })]);
    }
  });

  it("refuse la saisie avant la clôture des inscriptions", async () => {
    await db.collection("events").doc(EVENT).update({ status: "open" });
    await expect(classique([line(1, 10, "BERTEA André", 1)])).rejects.toSatisfy(code("event_not_finished"));
  });

  it("CSV : statuts, valeurs invalides et colonnes manquantes détectés", () => {
    const parsed = parseResultsCsv("Rang;Dossard;Nom;Points;Statut\n1;10;BERTEA André;385;\n;12;RIVIERE Romain;;abandon\n2;x;FOO Bar;12,5;\n3;7;BAZ Qux;abc;");
    expect(parsed.lines[1]).toMatchObject({ rank: null, status: "dnf", points: null });
    expect(parsed.lines[2].points).toBe(12.5);
    expect(parsed.errors).toEqual(expect.arrayContaining([expect.stringContaining("dossard invalide"), expect.stringContaining("score invalide")]));
    expect(parseResultsCsv("Foo;Bar\n1;2").errors).toContain("Colonne « nom » introuvable.");
  });
});

describe("reprise de l'instantané publié 2026", () => {
  it("brouillons seulement ; écarts d'orthographe et dossards inconnus signalés, rien de publié", async () => {
    const { draftsFromSnapshot2026 } = await import("@/lib/server/results/import-snapshot");
    await db.collection("categories").doc("classique").set({ eventId: EVENT, name: "Pizza Classique" });
    const drafts = await draftsFromSnapshot2026(db, EVENT);
    expect(drafts).toHaveLength(10);
    const classiqueDraft = drafts.find(draft => draft.categoryKey === "classique")!;
    expect(classiqueDraft.categoryId).toBe("classique");
    expect(drafts.find(draft => draft.categoryKey === "super-champion")!.categoryId).toBeNull();

    const saved = await saveResultDraft(db, classiqueDraft, admin);
    const martinnez = saved.lines.find(entry => entry.bib === 52)!;
    expect(martinnez).toMatchObject({ match: "bib_name_mismatch", holderId: "martinez" });
    expect(saved.lines.find(entry => entry.bib === 10)).toMatchObject({ match: "bib", holderId: "bertea", rank: 36, points: 385 });
    expect(saved.blocking.length).toBeGreaterThan(0);
    expect(await publicResults(db, EVENT)).toEqual([]);
    // Correction confirmée par l'organisateur : 4631 points, rang inchangé.
    const superChampion = drafts.find(draft => draft.categoryKey === "super-champion")!;
    expect(superChampion.lines[0]).toMatchObject({ rank: 1, bib: 61, name: "FARINA Gennaro", points: 4631 });
  });
});

describe("décisions manuelles : aucun contournement des contrôles serveur", () => {
  beforeEach(async () => {
    await person("retire", "Richard", "ROCLE", 70);
    await db.collection("participants").doc("retire").update({ withdrawn: true });
    await db.collection("slots").doc("s9").set({ eventId: EVENT, categoryId: "classique", status: "paid", participantIds: ["retire"], startTime: Timestamp.now() });
  });

  const draftWith = (decisions: object, lines = [line(1, null, "INCONNU Jean", 600), line(2, 10, "BERTEA André", 385)]) =>
    classique(lines, decisions);

  it("choix manuel d'une équipe pour un classement individuel, ou type falsifié : refusé", async () => {
    const team = await draftWith({ manualMatches: { 0: { holderKind: "team", holderId: "t18" } } });
    expect(team.lines[0]).toMatchObject({ holderId: null, confirmed: false });
    expect(team.lines[0].hardIssues.join(" ")).toContain("Choix manuel refusé");
    const spoofed = await draftWith({ manualMatches: { 0: { holderKind: "team", holderId: "prosper" } } });
    expect(spoofed.lines[0].hardIssues.join(" ")).toContain("type d'identité incohérent");
    expect(spoofed.blocking.length).toBeGreaterThan(0);
  });

  it("choix manuel d'un participant retiré ou non inscrit dans la catégorie : refusé", async () => {
    const withdrawn = await draftWith({ manualMatches: { 0: { holderKind: "participant", holderId: "retire" } } });
    expect(withdrawn.lines[0].hardIssues.join(" ")).toContain("retiré du planning");
    const otherCategory = await draftWith({ manualMatches: { 0: { holderKind: "participant", holderId: "marine" } } });
    expect(otherCategory.lines[0].hardIssues.join(" ")).toContain("n'est pas inscrit dans cette catégorie");
    expect(otherCategory.blocking.length).toBeGreaterThan(0);
  });

  it("choix manuel créant un doublon : bloqué par le contrôle de structure", async () => {
    const duplicate = await draftWith({ manualMatches: { 0: { holderKind: "participant", holderId: "bertea" } } });
    expect(duplicate.lines[0]).toMatchObject({ match: "manual", holderId: "bertea" });
    expect(duplicate.blocking.some(message => message.includes("apparaît deux fois"))).toBe(true);
    const set = (await db.collection("resultSets").doc(`${EVENT}_classique`).get()).data()!;
    await expect(validateResultSet(db, { id: `${EVENT}_classique`, expectedDraftVersion: set.draftVersion }, admin)).rejects.toSatisfy(code("blocking_issues"));
  });

  it("une confirmation ne lève ni une ligne inconnue, ni un dossard hors catégorie, ni un dossard retiré", async () => {
    const draft = await draftWith(
      { confirmedLines: [0, 1, 2] },
      [line(1, null, "INCONNU Jean", 600), line(2, 16, "BRIANÇON Marine", 500), line(3, 70, "ROCLE Richard", 400)]
    );
    expect(draft.lines.map(entry => entry.confirmed)).toEqual([false, false, false]);
    expect(draft.blocking.length).toBe(3);
  });

  it("choix manuel valide : rapprochement retenu, validation possible", async () => {
    const draft = await draftWith({ manualMatches: { 0: { holderKind: "participant", holderId: "prosper" } } });
    expect(draft.lines[0]).toMatchObject({ match: "manual", holderId: "prosper", confirmed: true, hardIssues: [] });
    expect(draft.blocking).toEqual([]);
    await validateResultSet(db, { id: `${EVENT}_classique`, expectedDraftVersion: 1 }, admin);
  });
});
