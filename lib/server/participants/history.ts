// Historique sportif d'un compte : les participants qu'il a inscrits, par
// édition, avec catégories, équipes et résultats PUBLIÉS uniquement.
// Aucune donnée privée (email, téléphone, paiement) n'est renvoyée.
import type { Firestore } from "firebase-admin/firestore";
import { displayName } from "@/lib/domain/names";
import { resultsOfParticipant } from "@/lib/server/results/service";

export interface AccountHistoryEdition {
  eventId: string;
  eventName: string;
  eventYear: number | null;
  participants: Array<{
    name: string;
    bib: number | null;
    categories: string[];
    teams: Array<{ category: string; members: string[]; bib: number | null }>;
    results: Array<{ category: string; rank: number | null; status: string; points: number | null; team: boolean }>;
  }>;
}

export async function accountHistory(db: Firestore, uid: string): Promise<AccountHistoryEdition[]> {
  const participants = await db.collection("participants").where("buyerIds", "array-contains", uid).get();
  const byEvent = new Map<string, typeof participants.docs>();
  participants.docs
    .filter(doc => !doc.data().withdrawn)
    .forEach(doc => byEvent.set(doc.data().eventId, [...(byEvent.get(doc.data().eventId) ?? []), doc]));

  const editions: AccountHistoryEdition[] = [];
  for (const [eventId, docs] of byEvent) {
    const [event, categories, slots, teams] = await Promise.all([
      db.collection("events").doc(eventId).get(),
      db.collection("categories").where("eventId", "==", eventId).get(),
      db.collection("slots").where("eventId", "==", eventId).get(),
      db.collection("teams").where("eventId", "==", eventId).get(),
    ]);
    const categoryName = new Map(categories.docs.map(doc => [doc.id, String(doc.data().name ?? doc.id)]));
    const memberNames = new Map<string, string>();
    const teamMemberIds = Array.from(new Set(teams.docs.flatMap(doc => doc.data().memberIds ?? [])));
    if (teamMemberIds.length) {
      (await db.getAll(...teamMemberIds.map(id => db.collection("participants").doc(id)))).forEach(doc => {
        if (doc.exists) memberNames.set(doc.id, displayName(doc.data() as { firstName: string; lastName: string }));
      });
    }
    const people = [];
    for (const doc of docs) {
      const data = doc.data();
      const ownSlots = slots.docs.filter(slot => slot.data().status !== "available" && (slot.data().participantIds ?? []).includes(doc.id));
      const ownTeams = teams.docs.filter(team => (team.data().memberIds ?? []).includes(doc.id));
      const results = await resultsOfParticipant(db, eventId, doc.id);
      people.push({
        name: displayName(data as { firstName: string; lastName: string }),
        bib: typeof data.bib === "number" ? data.bib : null,
        categories: Array.from(new Set(ownSlots.map(slot => categoryName.get(slot.data().categoryId) ?? slot.data().categoryId))),
        teams: ownTeams.map(team => ({
          category: categoryName.get(team.data().categoryId) ?? team.data().categoryId,
          members: (team.data().memberIds ?? []).map((id: string) => memberNames.get(id) ?? "—"),
          bib: typeof team.data().bib === "number" ? team.data().bib : null,
        })),
        results: results.map(result => ({ category: result.categoryName, rank: result.rank, status: result.status, points: result.points, team: result.kind === "team" })),
      });
    }
    editions.push({ eventId, eventName: event.data()?.name ?? eventId, eventYear: event.data()?.eventYear ?? null, participants: people });
  }
  return editions.sort((a, b) => (b.eventYear ?? 0) - (a.eventYear ?? 0));
}
