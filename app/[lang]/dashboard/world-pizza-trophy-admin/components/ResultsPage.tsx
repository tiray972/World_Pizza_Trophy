"use client";

// Résultats par catégorie : import (instantané publié ou CSV) en brouillon,
// rapprochements à confirmer, validation, aperçu et publication par catégorie.

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Upload, Download } from "lucide-react";
import { Button } from "./ui/Button";
import { adminFetch } from "../lib/adminFetch";
import { resultExports, type MatchedLine } from "@/lib/domain/results";
import type { Category, WPTEvent } from "@/types/firestore";

type SetView = {
  id: string; categoryKey: string; categoryName: string; categoryId: string | null; kind: "individual" | "team";
  status: string; isPublished: boolean; draftVersion: number; publishedVersion: number | null;
  draft: { lines: (MatchedLine & { confirmed?: boolean })[]; blocking: string[]; warnings: string[]; source: string } | null;
};

const STATUS_LABEL: Record<string, string> = { draft: "brouillon", validated: "validé", published: "publié" };
const MATCH_LABEL: Record<string, string> = { bib: "dossard", bib_name_mismatch: "dossard, nom différent", name_suggestion: "proposé sur le nom", none: "non rapproché" };

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const text = "﻿" + rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

export function ResultsPage({ selectedEvent, categories }: { selectedEvent?: WPTEvent; categories: Category[] }) {
  const [sets, setSets] = useState<SetView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<number[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState({ categoryId: "", kind: "individual", text: "" });

  const load = useCallback(async () => {
    if (!selectedEvent) return;
    try {
      const data = await adminFetch<{ sets: SetView[] }>(`/api/admin/results?eventId=${encodeURIComponent(selectedEvent.id)}`);
      setSets(data.sets);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    }
  }, [selectedEvent]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = sets.find(set => set.id === selectedId) ?? null;
  useEffect(() => {
    setConfirmed((selected?.draft?.lines ?? []).map((line, index) => (line.confirmed ? index : -1)).filter(index => index >= 0));
  }, [selected]);

  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: success });
      await load();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  if (!selectedEvent) return <p className="text-muted-foreground">Sélectionnez une édition.</p>;
  const finished = ["closed", "completed", "archived"].includes(selectedEvent.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Résultats</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Brouillon → validé → publié, catégorie par catégorie. Rapprochement par dossard dans l&apos;édition ; un nom seul n&apos;est
            jamais rattaché sans confirmation. L&apos;ordre officiel est conservé, ex æquo compris. Rien n&apos;est publié automatiquement.
          </p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Actualiser</Button>
      </div>
      {!finished && <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">La saisie des résultats ouvre lorsque l&apos;édition est close ou terminée.</p>}
      {message && <p className={`rounded-md border p-3 text-sm ${message.ok ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-800"}`} role="status">{message.text}</p>}

      {finished && (
        <div className="flex flex-wrap gap-2">
          {selectedEvent.eventYear === 2026 && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => act(() => adminFetch("/api/admin/results", { body: { action: "import-snapshot-2026", eventId: selectedEvent.id } }), "Classements 2026 importés en brouillon : vérifiez chaque catégorie avant validation.")}
            >
              <Upload className="mr-2 h-4 w-4" /> Importer les classements publiés 2026 (brouillon)
            </Button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="px-3 py-2">Classement</th><th className="px-3 py-2">État</th><th className="px-3 py-2">En ligne</th><th className="px-3 py-2">Lignes</th><th className="px-3 py-2">Bloquants</th><th /></tr></thead>
          <tbody>
            {sets.map(set => (
              <tr key={set.id} className={`border-t ${set.id === selectedId ? "bg-muted/40" : ""}`}>
                <td className="px-3 py-2 font-medium">{set.categoryName}{set.kind === "team" ? " (équipes)" : ""}</td>
                <td className="px-3 py-2">{STATUS_LABEL[set.status] ?? set.status}</td>
                <td className="px-3 py-2">{set.publishedVersion ? `v${set.publishedVersion}` : "—"}</td>
                <td className="px-3 py-2">{set.draft?.lines.length ?? 0}</td>
                <td className="px-3 py-2">{set.draft?.blocking.length ?? 0}</td>
                <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => setSelectedId(set.id)}>Ouvrir</Button></td>
              </tr>
            ))}
            {sets.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Aucun résultat saisi pour cette édition.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected?.draft && (
        <section className="space-y-3 rounded-md border p-4">
          <h2 className="text-lg font-semibold">{selected.categoryName} — brouillon v{selected.draftVersion}</h2>
          <p className="text-xs text-muted-foreground">Source : {selected.draft.source}</p>
          {selected.draft.blocking.length > 0 && (
            <ul className="list-disc space-y-1 rounded-md border border-red-300 bg-red-50 p-3 pl-8 text-sm text-red-800">{selected.draft.blocking.map(item => <li key={item}>{item}</li>)}</ul>
          )}
          {selected.draft.warnings.length > 0 && (
            <ul className="list-disc space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 pl-8 text-sm text-amber-900">{selected.draft.warnings.map(item => <li key={item}>{item}</li>)}</ul>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left"><tr><th className="py-1">Rang</th><th>Dossard</th><th>Feuille officielle</th><th>Points</th><th>Rapprochement</th><th>Fiche</th><th>Confirmer</th></tr></thead>
              <tbody>
                {selected.draft.lines.map((line, index) => (
                  <tr key={index} className="border-t align-top">
                    <td className="py-1">{line.status === "ranked" ? line.rank : line.status}</td>
                    <td>{line.bib ?? "—"}</td>
                    <td>{line.name}</td>
                    <td>{line.points ?? "—"}</td>
                    <td className={line.match === "bib" ? "text-green-700" : "text-amber-700"}>{MATCH_LABEL[line.match]}{line.issues.length > 0 && <span className="block text-xs text-muted-foreground">{line.issues.join(" ")}</span>}</td>
                    <td>{line.holderLabel ?? "—"}</td>
                    <td>
                      {line.match !== "bib" && line.holderId && (
                        <input type="checkbox" aria-label={`Confirmer ${line.name}`} checked={confirmed.includes(index)} onChange={event => setConfirmed(previous => (event.target.checked ? [...previous, index] : previous.filter(value => value !== index)))} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                act(
                  () => adminFetch("/api/admin/results", { body: { action: "draft", eventId: selectedEvent.id, categoryKey: selected.categoryKey, categoryId: selected.categoryId, categoryName: selected.categoryName, kind: selected.kind, lines: selected.draft!.lines.map(({ rank, status, points, bib, name, distinction }) => ({ rank, status, points, bib, name, distinction })), confirmedLines: confirmed, source: selected.draft!.source } }),
                  "Confirmations enregistrées."
                )
              }
            >
              Enregistrer les confirmations
            </Button>
            <Button disabled={busy || selected.draft.blocking.length > 0 || selected.status !== "draft"} onClick={() => act(() => adminFetch("/api/admin/results", { body: { action: "validate", id: selected.id, expectedDraftVersion: selected.draftVersion } }), "Résultats validés : relisez l'aperçu puis publiez.")}>Valider</Button>
            <Button
              disabled={busy || selected.status !== "validated"}
              onClick={() => {
                const podium = resultExports(selected.draft!.lines).podium.map(line => `${line.rank}. ${line.holderLabel ?? line.name}${line.points !== null ? ` (${line.points})` : ""}`).join("\n");
                if (!window.confirm(`Publier « ${selected.categoryName} » ?\n\n${podium}\n\n${selected.draft!.lines.length} ligne(s). Les noms affichés sont ceux des fiches participants.`)) return;
                act(() => adminFetch("/api/admin/results", { body: { action: "publish", id: selected.id } }), "Classement publié.");
              }}
            >
              Publier
            </Button>
            <Button
              variant="outline"
              disabled={selected.status === "draft"}
              onClick={() => {
                const exported = resultExports(selected.draft!.lines);
                const rows = (lines: typeof exported.full) => lines.map(line => [line.rank ?? line.status, line.bib, line.holderLabel ?? line.name, line.points]);
                downloadCsv(`${selected.categoryKey}-classement.csv`, [["Rang", "Dossard", "Nom", "Points"], ...rows(exported.full)]);
                downloadCsv(`${selected.categoryKey}-podium.csv`, [["Rang", "Dossard", "Nom", "Points"], ...rows(exported.podium)]);
                if (exported.top10) downloadCsv(`${selected.categoryKey}-top10.csv`, [["Rang", "Dossard", "Nom", "Points"], ...rows(exported.top10)]);
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Exports (validé)
            </Button>
          </div>
        </section>
      )}

      {finished && (
        <section className="space-y-2 rounded-md border p-4">
          <h2 className="font-semibold">Importer une feuille officielle (CSV)</h2>
          <p className="text-xs text-muted-foreground">Colonnes : Rang ; Dossard ; Nom ; Points ; Statut (absent, abandon, disqualifié) ; Distinction. Séparateur « ; » ou « , ».</p>
          <div className="flex flex-wrap gap-2">
            <select className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Catégorie" value={csv.categoryId} onChange={event => setCsv({ ...csv, categoryId: event.target.value })}>
              <option value="">— catégorie —</option>
              {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Type de classement" value={csv.kind} onChange={event => setCsv({ ...csv, kind: event.target.value })}>
              <option value="individual">individuel</option>
              <option value="team">équipes</option>
            </select>
          </div>
          <textarea className="min-h-32 w-full rounded-md border bg-background p-2 font-mono text-xs" aria-label="Contenu CSV" value={csv.text} onChange={event => setCsv({ ...csv, text: event.target.value })} />
          <Button
            disabled={busy || !csv.categoryId || !csv.text.trim()}
            onClick={() => {
              const category = categories.find(item => item.id === csv.categoryId)!;
              act(() => adminFetch("/api/admin/results", { body: { action: "draft", eventId: selectedEvent.id, categoryKey: category.id, categoryId: category.id, categoryName: category.name, kind: csv.kind, csv: csv.text, source: "import CSV" } }), "Feuille importée en brouillon : vérifiez les rapprochements.");
            }}
          >
            Importer en brouillon
          </Button>
        </section>
      )}
    </div>
  );
}
