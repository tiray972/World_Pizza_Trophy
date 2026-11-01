// lib/domain/results-public.ts
// Page publique des résultats : classements publiés en base, et repli sur
// l'instantané versionné (lib/results/2026.json) catégorie par catégorie —
// une catégorie pas encore publiée en base reste visible telle qu'annoncée.

export interface PublicEntry {
  rank: number | null;
  status: string;
  name: string;
  bib: number | null;
  points: number | null;
  members?: string[];
}

export interface PublicCategory {
  id: string;
  name: string;
  kind: "individual" | "team";
  entries: PublicEntry[];
  source: "published" | "snapshot";
  updatedAt: string | null;
}

export interface SnapshotCategory {
  id: string;
  name: string;
  kind: string;
  entries: { rank: number; name: string; bib?: number; points?: number }[];
}

export interface PublishedSet {
  categoryKey: string;
  categoryName: string;
  kind: "individual" | "team";
  publishedAt: string | null;
  lines: PublicEntry[];
}

export function mergePublishedWithSnapshot(snapshot: SnapshotCategory[], published: PublishedSet[]): PublicCategory[] {
  const byKey = new Map(published.map(set => [set.categoryKey, set]));
  const merged: PublicCategory[] = snapshot.map(category => {
    const set = byKey.get(category.id);
    if (set) {
      return { id: category.id, name: category.name, kind: set.kind, entries: set.lines, source: "published", updatedAt: set.publishedAt };
    }
    return {
      id: category.id,
      name: category.name,
      kind: category.kind === "team" ? "team" : "individual",
      entries: category.entries.map(entry => ({
        rank: entry.rank,
        status: "ranked",
        name: entry.name,
        bib: typeof entry.bib === "number" ? entry.bib : null,
        points: typeof entry.points === "number" ? entry.points : null,
      })),
      source: "snapshot",
      updatedAt: null,
    };
  });
  // Catégories publiées en base sans équivalent dans l'instantané.
  for (const set of published) {
    if (!snapshot.some(category => category.id === set.categoryKey)) {
      merged.push({ id: set.categoryKey, name: set.categoryName, kind: set.kind, entries: set.lines, source: "published", updatedAt: set.publishedAt });
    }
  }
  return merged;
}
