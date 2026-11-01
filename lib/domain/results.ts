// lib/domain/results.ts
// Résultats par catégorie : lignes importées (CSV ou instantané publié),
// rapprochement avec les identités de l'édition, contrôles avant validation.
//
// Règles :
//  - le rapprochement se fait par dossard dans le périmètre de l'édition ; un
//    nom seul ne rattache jamais automatiquement (proposition à valider) ;
//  - l'ordre officiel est conservé tel quel, y compris à points égaux : aucun
//    départage inventé, aucun tri par score ;
//  - une absence, un abandon ou une disqualification n'est pas une dernière place ;
//  - aucun score n'est inventé : vide reste vide.

import { displayName, looseNameKey, normalizeSpaces } from "./names";

export type ResultStatus = "ranked" | "absent" | "dnf" | "dsq";

export interface ResultLine {
  /** Rang officiel (null pour absent / abandon / disqualifié). */
  rank: number | null;
  status: ResultStatus;
  points: number | null;
  bib: number | null;
  /** Nom tel qu'il figure sur la feuille officielle. */
  name: string;
  distinction?: string | null;
}

export interface IdentityIndexEntry {
  kind: "participant" | "team";
  id: string;
  bib: number | null;
  /** Noms des personnes (un pour un participant, les membres pour une équipe). */
  names: { firstName: string; lastName: string }[];
  displayName?: string | null;
  /** Catégories où cette identité est inscrite. */
  categoryIds: string[];
}

export type MatchKind = "bib" | "bib_name_mismatch" | "name_suggestion" | "none";

export interface MatchedLine extends ResultLine {
  match: MatchKind;
  holderKind: "participant" | "team" | null;
  holderId: string | null;
  holderLabel: string | null;
  issues: string[];
}

export interface ResultValidation {
  lines: MatchedLine[];
  /** Erreurs de structure (doublons, ordre) + lignes non rapprochées. */
  blocking: string[];
  /** Erreurs de structure seules (sans les lignes). */
  structural?: string[];
  warnings: string[];
}

const STATUS_WORDS: Record<string, ResultStatus> = {
  abs: "absent", absent: "absent", "non présent": "absent", dns: "absent",
  abandon: "dnf", dnf: "dnf", ab: "dnf",
  disqualifié: "dsq", disqualifie: "dsq", dsq: "dsq", dq: "dsq",
};

/** Lecture d'un CSV (`;` ou `,`) : rang, dossard, nom, points, statut, distinction. */
export function parseResultsCsv(text: string): { lines: ResultLine[]; errors: string[] } {
  const rows = text.replace(/^﻿/, "").split(/\r?\n/).filter(row => row.trim());
  if (rows.length === 0) return { lines: [], errors: ["Fichier vide."] };
  const separator = rows[0].includes(";") ? ";" : ",";
  const split = (row: string) => row.split(separator).map(cell => cell.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
  const header = split(rows[0]).map(cell => cell.toLowerCase());
  const column = (...names: string[]) => header.findIndex(cell => names.some(name => cell.includes(name)));
  const columns = {
    rank: column("rang", "rank", "place"),
    bib: column("dossard", "bib", "badge"),
    name: column("nom", "name", "participant", "équipe", "equipe"),
    points: column("point", "score"),
    status: column("statut", "status"),
    distinction: column("distinction", "prix", "award"),
  };
  const errors: string[] = [];
  if (columns.name < 0) errors.push("Colonne « nom » introuvable.");
  if (columns.rank < 0) errors.push("Colonne « rang » introuvable.");
  if (errors.length) return { lines: [], errors };

  const lines = rows.slice(1).map((row, index) => {
    const cells = split(row);
    const value = (column: number) => (column >= 0 ? cells[column] ?? "" : "");
    const statusWord = value(columns.status).toLowerCase();
    const status: ResultStatus = STATUS_WORDS[statusWord] ?? "ranked";
    const rankText = value(columns.rank);
    const pointsText = value(columns.points).replace(",", ".");
    const bibText = value(columns.bib);
    const rank = /^\d+$/.test(rankText) ? Number(rankText) : null;
    const points = pointsText === "" ? null : Number(pointsText);
    const bib = /^\d+$/.test(bibText) ? Number(bibText) : null;
    if (status === "ranked" && rank === null) errors.push(`Ligne ${index + 2} : rang manquant ou invalide (« ${rankText} »).`);
    if (points !== null && !Number.isFinite(points)) errors.push(`Ligne ${index + 2} : score invalide (« ${value(columns.points)} »).`);
    if (bibText && bib === null) errors.push(`Ligne ${index + 2} : dossard invalide (« ${bibText} »).`);
    return {
      rank: status === "ranked" ? rank : null,
      status,
      points: points !== null && Number.isFinite(points) ? points : null,
      bib,
      name: normalizeSpaces(value(columns.name)),
      distinction: value(columns.distinction) || null,
    };
  });
  return { lines, errors };
}

function namesOf(line: string): string[] {
  // « NOM Prénom - NOM Prénom » ou « NOM / NOM » pour une équipe.
  return line.split(/\s+-\s+|\s*\/\s*/).map(normalizeSpaces).filter(Boolean);
}

function looseOfDisplay(value: string): string {
  return looseNameKey({ firstName: "", lastName: value }).replace(/\|/g, "").split(" ").sort().join(" ");
}

function looseOfPerson(person: { firstName: string; lastName: string }): string {
  return looseOfDisplay(`${person.lastName} ${person.firstName}`);
}

/**
 * Rapproche les lignes d'une catégorie avec les identités de l'édition et
 * signale tout ce qui empêche une validation sûre.
 */
export function validateResults(
  input: { categoryId: string | null; kind: "individual" | "team"; lines: ResultLine[] },
  index: IdentityIndexEntry[]
): ResultValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const byBib = new Map<number, IdentityIndexEntry>();
  index.forEach(entry => entry.bib !== null && byBib.set(entry.bib, entry));
  const expectedKind = input.kind === "team" ? "team" : "participant";

  const lines: MatchedLine[] = input.lines.map(line => {
    const issues: string[] = [];
    const lineNames = namesOf(line.name);
    let holder: IdentityIndexEntry | undefined = line.bib !== null ? byBib.get(line.bib) : undefined;
    let match: MatchKind = "none";

    if (holder) {
      if (holder.kind !== expectedKind) {
        issues.push(`Dossard ${line.bib} porté par ${holder.kind === "team" ? "une équipe" : "un participant individuel"} : mauvaise catégorie ou mauvais dossard.`);
        holder = undefined;
      } else {
        const holderKeys = new Set(holder.names.map(looseOfPerson));
        const lineKeys = lineNames.map(looseOfDisplay);
        // Un nom d'équipe publié avec des prénoms incomplets (« FARINA / POULARD ») reste rattaché par son dossard.
        const sameNames = lineKeys.every(key => holderKeys.has(key) || [...holderKeys].some(holderKey => holderKey.split(" ").includes(key)));
        match = sameNames ? "bib" : "bib_name_mismatch";
        if (!sameNames) issues.push(`Dossard ${line.bib} : la feuille indique « ${line.name} », la fiche indique « ${holder.displayName || holder.names.map(displayName).join(" – ")} ». À confirmer.`);
        if (input.categoryId && !holder.categoryIds.includes(input.categoryId)) {
          issues.push(`${holder.displayName || holder.names.map(displayName).join(" – ")} n'est pas inscrit dans cette catégorie.`);
        }
      }
    } else if (line.bib !== null) {
      issues.push(`Dossard ${line.bib} inconnu dans cette édition.`);
    }

    if (!holder && match === "none") {
      const candidates = index.filter(entry => entry.kind === expectedKind && entry.names.some(person => lineNames.map(looseOfDisplay).includes(looseOfPerson(person))));
      if (candidates.length === 1) {
        match = "name_suggestion";
        holder = candidates[0];
        issues.push(`Rapprochement proposé sur le nom (${holder.names.map(displayName).join(" – ")}) : à valider, jamais automatique.`);
      } else if (candidates.length > 1) {
        issues.push(`Nom ambigu : ${candidates.length} identités possibles. Choix manuel requis.`);
      } else {
        issues.push("Participant ou équipe inconnu dans cette édition.");
      }
    }

    if (expectedKind === "team" && holder && match !== "name_suggestion" && holder.names.length < 2) {
      warnings.push(`${line.name} : équipe incomplète dans la base.`);
    }

    return {
      ...line,
      match,
      holderKind: holder ? holder.kind : null,
      holderId: holder && match !== "none" ? holder.id : null,
      holderLabel: holder ? holder.displayName || holder.names.map(displayName).join(" – ") : null,
      issues,
    };
  });

  // Doublons de résultat et cohérence du classement (sans le recalculer).
  const seen = new Map<string, number>();
  lines.forEach((line, position) => {
    if (!line.holderId) return;
    if (seen.has(line.holderId)) blocking.push(`${line.holderLabel} apparaît deux fois (lignes ${seen.get(line.holderId)! + 1} et ${position + 1}).`);
    seen.set(line.holderId, position);
  });
  const ranked = lines.filter(line => line.status === "ranked" && line.rank !== null);
  ranked.forEach((line, position) => {
    const previous = ranked[position - 1];
    if (!previous) {
      if (line.rank !== 1) warnings.push(`Le classement commence au rang ${line.rank}.`);
      return;
    }
    if (line.rank! < previous.rank!) blocking.push(`Rang ${line.rank} après le rang ${previous.rank} : l'ordre de la feuille doit être conservé.`);
    if (line.rank === previous.rank) warnings.push(`Ex æquo au rang ${line.rank} : conservé tel que publié, sans départage.`);
    if (line.rank! > previous.rank! + 1 && line.rank !== position + 1) warnings.push(`Rang ${previous.rank} puis ${line.rank} : rang(s) manquant(s).`);
    if (previous.points !== null && line.points !== null && line.points === previous.points && line.rank !== previous.rank) {
      warnings.push(`Points égaux (${line.points}) aux rangs ${previous.rank} et ${line.rank} : ordre officiel conservé, aucun départage recalculé.`);
    }
  });
  lines.forEach(line => {
    if (line.issues.length && line.match === "bib") warnings.push(`${line.name} : ${line.issues.join(" ")}`);
  });

  // `blocking` = erreurs de structure ; les lignes non rapprochées sûrement
  // s'ajoutent tant qu'elles ne sont pas confirmées (voir lineBlocks).
  return {
    lines,
    structural: Array.from(new Set(blocking)),
    blocking: Array.from(new Set([...blocking, ...lines.filter(line => lineBlocks(line, false)).map(lineMessage)])),
    warnings: Array.from(new Set(warnings)),
  };
}

/** Une ligne bloque la validation tant que son rapprochement n'est pas sûr ou confirmé. */
export function lineBlocks(line: Pick<MatchedLine, "match" | "issues">, confirmed: boolean): boolean {
  return line.match !== "bib" && line.issues.length > 0 && !confirmed;
}

export function lineMessage(line: Pick<MatchedLine, "name" | "issues">): string {
  return `${line.name} : ${line.issues.join(" ")}`;
}

/** Lignes d'export : podium, top 10 (si au moins dix classés), classement complet. */
export function resultExports(lines: Pick<MatchedLine, "rank" | "status" | "name" | "bib" | "points" | "holderLabel">[]) {
  const ranked = lines.filter(line => line.status === "ranked" && line.rank !== null);
  return {
    podium: ranked.filter(line => line.rank! <= 3),
    top10: ranked.length >= 10 ? ranked.filter(line => line.rank! <= 10) : null,
    full: lines,
  };
}
