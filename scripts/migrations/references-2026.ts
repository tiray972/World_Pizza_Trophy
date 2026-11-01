// Dossards 2026 : feuilles de planning imprimées (instantanés Google Sheets de
// tmp/) et classements publiés (lib/results/2026.json). Lecture seule.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { BibReference } from "@/lib/server/migrations/identities";
import type { PersonName } from "@/lib/domain/names";

const ROOT = path.resolve(__dirname, "../..");
const SNAPSHOTS = ["print-data.json", "reprint-data.json", "corrected-pages.json", "tuesday-current.json", "wednesday-current.json", "calzone-28-update.json"];

type Sheet = { properties: { title: string }; data: { rowData?: { values?: { formattedValue?: string }[] }[] }[] };

/** « NOM Prénom » → { lastName, firstName } : les mots en capitales forment le nom. */
export function splitDisplayName(value: string): PersonName {
  const words = value.trim().split(/\s+/);
  const isUpper = (word: string) => word === word.toLocaleUpperCase("fr-FR") && /\p{L}/u.test(word);
  let index = 0;
  while (index < words.length - 1 && isUpper(words[index])) index++;
  if (index === 0) index = 1;
  return { lastName: words.slice(0, index).join(" "), firstName: words.slice(index).join(" ") };
}

export function planningReferences(): BibReference[] {
  const references: BibReference[] = [];
  for (const file of SNAPSHOTS) {
    const full = path.join(ROOT, "tmp", file);
    if (!existsSync(full)) continue;
    const json = JSON.parse(readFileSync(full, "utf8"));
    const sheets: Sheet[] = json.sheets ?? json.source?.sheets ?? [];
    for (const sheet of sheets) {
      const isTeam = /due|ziolo/i.test(sheet.properties.title);
      const byBib = new Map<number, PersonName[]>();
      for (const row of sheet.data[0]?.rowData?.slice(1) ?? []) {
        const values = (row.values ?? []).map(cell => cell.formattedValue ?? "");
        const bib = Number(values[4]);
        if (!Number.isInteger(bib) || bib <= 0 || !values[5]) continue;
        byBib.set(bib, [...(byBib.get(bib) ?? []), { lastName: values[5], firstName: values[6] ?? "" }]);
      }
      for (const [bib, names] of byBib) {
        const source = `tmp/${file} › ${sheet.properties.title}`;
        if (isTeam) references.push({ kind: "team", bib, names, source });
        else names.forEach(name => references.push({ kind: "individual", bib, names: [name], source }));
      }
    }
  }
  return references;
}

export function resultsReferences(): BibReference[] {
  const results = JSON.parse(readFileSync(path.join(ROOT, "lib/results/2026.json"), "utf8"));
  const references: BibReference[] = [];
  for (const category of results.categories) {
    for (const entry of category.entries) {
      if (typeof entry.bib !== "number") continue;
      const source = `lib/results/2026.json › ${category.name}`;
      if (category.kind === "team") {
        // « NOM Prénom - NOM Prénom » ; « NOM / NOM » (prénoms inconnus) n'est pas exploitable pour un rapprochement strict.
        if (!String(entry.name).includes(" - ")) continue;
        references.push({ kind: "team", bib: entry.bib, names: String(entry.name).split(" - ").map(splitDisplayName), source, priority: 2 });
      } else {
        references.push({ kind: "individual", bib: entry.bib, names: [splitDisplayName(String(entry.name))], source, priority: 2 });
      }
    }
  }
  return references;
}

export function references2026(): BibReference[] {
  return [...planningReferences(), ...resultsReferences()];
}
