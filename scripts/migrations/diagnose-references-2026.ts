// Diagnostic des documents de référence 2026 (lecture seule, sans base) :
// contradictions de dossards entre versions des plannings et résultats.
//   npx vite-node --config vitest.config.ts scripts/migrations/diagnose-references-2026.ts
import { displayName, looseNameKey, strictNameKey } from "@/lib/domain/names";
import { planningReferences, resultsReferences } from "./references-2026";
import type { BibReference } from "@/lib/server/migrations/identities";

const planning = planningReferences();
const results = resultsReferences();
const all: BibReference[] = [...planning, ...results];
const sources = new Map<string, number>();
all.forEach(reference => sources.set(reference.source.split(" › ")[0], (sources.get(reference.source.split(" › ")[0]) ?? 0) + 1));
console.log("Références par fichier :", Object.fromEntries(sources));

const holders = new Map<string, Map<string, Set<string>>>();
for (const reference of all) {
  const key = `${reference.kind}:${reference.bib}`;
  const names = reference.names.map(displayName).sort().join(" – ");
  const byName = holders.get(key) ?? new Map<string, Set<string>>();
  byName.set(names, new Set([...(byName.get(names) ?? []), reference.source.split(" › ")[0]]));
  holders.set(key, byName);
}
console.log("\nNuméros portés par plusieurs écritures (à relire, rien n'est tranché) :");
for (const [key, byName] of holders) {
  if (byName.size < 2) continue;
  const loose = new Set([...byName.keys()].map(name => looseNameKey({ firstName: "", lastName: name })));
  console.log(` ${key} ${loose.size === 1 ? "(accents/casse seulement)" : "(PORTEURS DIFFÉRENTS)"}: ${[...byName].map(([name, files]) => `${name} [${[...files].join(", ")}]`).join(" | ")}`);
}

const planningNames = new Set(planning.filter(reference => reference.kind === "individual").map(reference => looseNameKey(reference.names[0])));
console.log("\nPrésents dans les résultats, absents des plannings (ajouts tardifs) :");
for (const reference of results.filter(entry => entry.kind === "individual")) {
  if (!planningNames.has(looseNameKey(reference.names[0]))) console.log(` n° ${reference.bib} ${displayName(reference.names[0])} — ${reference.source}`);
}

const bibsByName = new Map<string, Set<number>>();
planning.filter(reference => reference.kind === "individual").forEach(reference => {
  const key = strictNameKey(reference.names[0]);
  bibsByName.set(key, new Set([...(bibsByName.get(key) ?? []), reference.bib]));
});
console.log("\nNoms avec plusieurs dossards dans les plannings :", [...bibsByName].filter(([, bibs]) => bibs.size > 1));
console.log("\nÉquipes des plannings :", planning.filter(reference => reference.kind === "team").map(reference => `n° ${reference.bib} ${reference.names.map(displayName).join(" – ")}`).filter((value, index, list) => list.indexOf(value) === index));
