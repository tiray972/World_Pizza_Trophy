import { beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { accountHistory } from "@/lib/server/participants/history";
import { publishResultSet, saveResultDraft, validateResultSet } from "@/lib/server/results/service";
import { resetDb, testDb } from "../helpers/emulator";

const db = testDb();
const admin = { actor: { uid: "admin1", displayName: "Admin" } };
const EVENT = "evt2026";

beforeEach(async () => {
  await resetDb();
  await db.collection("events").doc(EVENT).set({ name: "WPT 2026", eventYear: 2026, status: "completed" });
  await db.collection("categories").doc("classique").set({ eventId: EVENT, name: "Classique" });
  await db.collection("categories").doc("due").set({ eventId: EVENT, name: "Pizza Due", participantsPerSlot: 2 });
  await db.collection("participants").doc("marine").set({ eventId: EVENT, firstName: "Marine", lastName: "BRIANÇON", bib: 16, buyerIds: ["buyer1"], email: "secret@example.test", phone: "06", version: 1 });
  await db.collection("participants").doc("jeremy").set({ eventId: EVENT, firstName: "Jeremy", lastName: "CHION", bib: null, buyerIds: ["buyer2"], version: 1 });
  await db.collection("slots").doc("s1").set({ eventId: EVENT, categoryId: "classique", status: "paid", participantIds: ["marine"], startTime: Timestamp.now() });
  await db.collection("slots").doc("d1").set({ eventId: EVENT, categoryId: "due", status: "paid", participantIds: ["marine", "jeremy"], teamId: "t18", startTime: Timestamp.now() });
  await db.collection("teams").doc("t18").set({ eventId: EVENT, categoryId: "due", slotId: "d1", memberIds: ["marine", "jeremy"], bib: 18, status: "complete", requiredMembers: 2 });
});

describe("historique du compte", () => {
  it("éditions, catégories, équipes et résultats publiés seulement, sans données privées", async () => {
    await saveResultDraft(db, { eventId: EVENT, categoryKey: "chef-ziolo", categoryId: "due", categoryName: "Trophée Chef'Ziolo", kind: "team", lines: [{ rank: 1, status: "ranked", bib: 18, name: "BRIANCON Marine - CHION Jeremy", points: 738 }], source: "test" }, admin);
    let history = await accountHistory(db, "buyer1");
    expect(history[0].participants[0].results).toEqual([]);

    await validateResultSet(db, { id: `${EVENT}_chef-ziolo`, expectedDraftVersion: 1 }, admin);
    await publishResultSet(db, { id: `${EVENT}_chef-ziolo` }, admin);
    history = await accountHistory(db, "buyer1");
    expect(history).toHaveLength(1);
    const [marine] = history[0].participants;
    expect(marine).toMatchObject({ name: "BRIANÇON Marine", bib: 16, categories: expect.arrayContaining(["Classique", "Pizza Due"]) });
    expect(marine.teams).toEqual([{ category: "Pizza Due", members: ["BRIANÇON Marine", "CHION Jeremy"], bib: 18 }]);
    expect(marine.results).toEqual([{ category: "Trophée Chef'Ziolo", rank: 1, status: "ranked", points: 738, team: true }]);
    expect(JSON.stringify(history)).not.toContain("secret@example.test");
    // L'équipier inscrit par un autre compte voit le même résultat d'équipe sur son propre historique.
    expect((await accountHistory(db, "buyer2"))[0].participants[0].results[0]).toMatchObject({ rank: 1, team: true });
  });
});
