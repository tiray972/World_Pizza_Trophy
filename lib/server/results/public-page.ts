// Lecture serveur des classements publiés pour la page publique. Toute
// indisponibilité (configuration absente au build, base injoignable) retombe
// sur l'instantané versionné : la page ne disparaît jamais.
import snapshot from "@/lib/results/2026.json";
import { mergePublishedWithSnapshot, type PublicCategory, type PublishedSet, type SnapshotCategory } from "@/lib/domain/results-public";

export async function resultsForEdition(year: number): Promise<PublicCategory[]> {
  const base = year === snapshot.year ? (snapshot.categories as SnapshotCategory[]) : [];
  let published: PublishedSet[] = [];
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      const { adminDB } = await import("@/lib/firebase/admin");
      const { publicResults } = await import("./service");
      const events = await adminDB.collection("events").where("eventYear", "==", year).get();
      for (const event of events.docs) {
        published = published.concat(await publicResults(adminDB, event.id));
      }
    }
  } catch (error) {
    console.warn("Résultats publiés indisponibles, instantané affiché :", error instanceof Error ? error.message : error);
  }
  return mergePublishedWithSnapshot(base, published);
}
