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
  /** Participant retiré du planning : jamais rattachable à un résultat. */
  withdrawn?: boolean;
}

export type MatchKind = "bib" | "manual" | "bib_name_mismatch" | "name_suggestion" | "none";

export interface MatchedLine extends ResultLine {
  match: MatchKind;
  holderKind: "participant" | "team" | null;
  holderId: string | null;
  holderLabel: string | null;
  /** Tous les constats de la ligne (affichage). */
  issues: string[];
  /** Constats qu'aucune confirmation ne peut lever (catégorie, type, retrait, inconnu…). */
  hardIssues: string[];
  /** Rapprochement proposé que l'administrateur peut confirmer. */
  confirmable: boolean;
  confirmed: boolean;
}

export interface ResultDecisions {
  /** Index des lignes dont le rapprochement proposé est confirmé. */
  confirmedLines?: number[];
  /** Rapprochements choisis à la main (index de ligne → identité). */
  manualMatches?: Record<number, { holderKind: "participant" | "team"; holderId: string }>;
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

const labelOf = (holder: IdentityIndexEntry) => holder.displayName || holder.names.map(displayName).join(" – ");

/** Contrôles qu'aucune confirmation ne lève : type, catégorie disputée, retrait. */
function holderHardIssues(holder: IdentityIndexEntry, expectedKind: "participant" | "team", categoryId: string | null): string[] {
  const issues: string[] = [];
  if (holder.kind !== expectedKind) {
    issues.push(`${labelOf(holder)} est ${holder.kind === "team" ? "une équipe" : "un participant individuel"} : incompatible avec un classement ${expectedKind === "team" ? "par équipes" : "individuel"}.`);
  }
  if (holder.withdrawn) issues.push(`${labelOf(holder)} est retiré du planning.`);
  if (categoryId && !holder.categoryIds.includes(categoryId)) issues.push(`${labelOf(holder)} n'est pas inscrit dans cette catégorie.`);
  return issues;
}

/**
 * Rapproche les lignes d'une catégorie avec les identités de l'édition,
 * applique les décisions de l'administrateur (confirmations, choix manuels)
 * en les revalidant, puis contrôle la structure du classement.
 */
export function validateResults(
  input: { categoryId: string | null; kind: "individual" | "team"; lines: ResultLine[] },
  index: IdentityIndexEntry[],
  decisions: ResultDecisions = {}
): ResultValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const byBib = new Map<number, IdentityIndexEntry>();
  index.forEach(entry => entry.bib !== null && byBib.set(entry.bib, entry));
  const byId = new Map(index.map(entry => [entry.id, entry]));
  const expectedKind = input.kind === "team" ? "team" : "participant";
  const confirmedLines = new Set(decisions.confirmedLines ?? []);

  const lines: MatchedLine[] = input.lines.map((line, position) => {
    const issues: string[] = [];
    const hardIssues: string[] = [];
    const lineNames = namesOf(line.name);
    let holder: IdentityIndexEntry | undefined;
    let match: MatchKind = "none";

    const manual = decisions.manualMatches?.[position];
    if (manual) {
      // Choix manuel : mêmes contrôles qu'un rapprochement automatique.
      const chosen = byId.get(manual.holderId);
      const refused = !chosen
        ? ["identité inconnue dans cette édition"]
        : chosen.kind !== manual.holderKind
          ? ["type d'identité incohérent"]
          : holderHardIssues(chosen, expectedKind, input.categoryId);
      if (chosen && refused.length === 0) {
        holder = chosen;
        match = "manual";
        issues.push(`Rapprochement choisi manuellement : ${labelOf(chosen)}.`);
      } else {
        hardIssues.push(`Choix manuel refusé : ${refused.join(" ")}`);
      }
    }

    if (!holder && match === "none" && hardIssues.length === 0) {
      const byNumber = line.bib !== null ? byBib.get(line.bib) : undefined;
      if (byNumber) {
        const holderKeys = new Set(byNumber.names.map(looseOfPerson));
        const lineKeys = lineNames.map(looseOfDisplay);
        // Un nom d'équipe publié avec des prénoms incomplets (« FARINA / POULARD ») reste rattaché par son dossard.
        const sameNames = lineKeys.every(key => holderKeys.has(key) || [...holderKeys].some(holderKey => holderKey.split(" ").includes(key)));
        holder = byNumber;
        match = sameNames ? "bib" : "bib_name_mismatch";
        if (!sameNames) issues.push(`Dossard ${line.bib} : la feuille indique « ${line.name} », la fiche indique « ${labelOf(byNumber)} ». À confirmer.`);
        hardIssues.push(...holderHardIssues(byNumber, expectedKind, input.categoryId));
      } else {
        if (line.bib !== null) issues.push(`Dossard ${line.bib} inconnu dans cette édition.`);
        const candidates = index.filter(entry => entry.kind === expectedKind && !entry.withdrawn && entry.names.some(person => lineNames.map(looseOfDisplay).includes(looseOfPerson(person))));
        if (candidates.length === 1) {
          holder = candidates[0];
          match = "name_suggestion";
          issues.push(`Rapprochement proposé sur le nom (${labelOf(holder)}) : à valider, jamais automatique.`);
          hardIssues.push(...holderHardIssues(holder, expectedKind, input.categoryId));
        } else if (candidates.length > 1) {
          hardIssues.push(`Nom ambigu : ${candidates.length} identités possibles. Choix manuel requis.`);
        } else {
          hardIssues.push("Participant ou équipe inconnu dans cette édition.");
        }
      }
    }

    if (expectedKind === "team" && holder && holder.kind === "team" && holder.names.length < 2) {
      warnings.push(`${line.name} : équipe incomplète dans la base.`);
    }
    const confirmable = (match === "bib_name_mismatch" || match === "name_suggestion") && hardIssues.length === 0;
    const confirmed = match === "manual" || (confirmable && confirmedLines.has(position));

    return {
      ...line,
      match,
      holderKind: holder ? holder.kind : null,
      holderId: holder ? holder.id : null,
      holderLabel: holder ? labelOf(holder) : null,
      issues: [...issues, ...hardIssues],
      hardIssues,
      confirmable,
      confirmed,
    };
  });

  // Contrôles de structure APRÈS les décisions : un choix manuel ne crée pas de doublon.
  const seen = new Map<string, number>();
  lines.forEach((line, position) => {
    if (!line.holderId || line.hardIssues.length > 0) return;
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
    if (line.status === "ranked" && line.rank === null) blocking.push(`${line.name} : rang manquant.`);
    if (line.points !== null && !Number.isFinite(line.points)) blocking.push(`${line.name} : score invalide.`);
  });

  return {
    lines,
    structural: Array.from(new Set(blocking)),
    blocking: Array.from(new Set([...blocking, ...lines.filter(lineBlocks).map(lineMessage)])),
    warnings: Array.from(new Set(warnings)),
  };
}

/** Une ligne bloque tant qu'elle a un constat non contournable ou un rapprochement non confirmé. */
export function lineBlocks(line: Pick<MatchedLine, "match" | "hardIssues" | "confirmed">): boolean {
  if (line.hardIssues.length > 0) return true;
  if (line.match === "bib" || line.match === "manual") return false;
  return !line.confirmed;
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
