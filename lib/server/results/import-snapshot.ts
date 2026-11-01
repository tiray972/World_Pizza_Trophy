// Reprise de l'instantané publié (lib/results/2026.json) en BROUILLONS de
// résultats. Rien n'est publié : chaque catégorie passe par la validation.
import type { Firestore } from "firebase-admin/firestore";
import snapshot from "@/lib/results/2026.json";
import { ruleSlugForCategoryName } from "@/lib/i18n/category-rule-slugs";
import type { ResultLine } from "@/lib/domain/results";
import type { DraftInput } from "./service";

type SnapshotCategory = { id: string; name: string; kind: string; entries: { rank: number; name: string; bib?: number; points?: number }[] };

export async function draftsFromSnapshot2026(db: Firestore, eventId: string): Promise<DraftInput[]> {
  const categories = await db.collection("categories").where("eventId", "==", eventId).get();
  const bySlug = new Map(categories.docs.map(doc => [ruleSlugForCategoryName(String(doc.data().name ?? "")), doc]));
  return (snapshot.categories as SnapshotCategory[]).map(category => {
    // « super-champion » est un classement général : aucune catégorie de réservation.
    const slug = category.id === "chef-ziolo" ? "doue" : ruleSlugForCategoryName(category.name);
    const doc = slug ? bySlug.get(slug) : undefined;
    const lines: ResultLine[] = category.entries.map(entry => ({
      rank: entry.rank,
      status: "ranked",
      points: typeof entry.points === "number" ? entry.points : null,
      bib: typeof entry.bib === "number" ? entry.bib : null,
      name: entry.name,
    }));
    return {
      eventId,
      categoryKey: category.id,
      categoryId: doc?.id ?? null,
      categoryName: category.name,
      kind: category.kind === "team" ? "team" : "individual",
      lines,
      source: `lib/results/2026.json (${snapshot.sourceUrl ?? "publication officielle"})`,
    };
  });
}
