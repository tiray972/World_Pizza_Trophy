"use client";

// Outils de cycle de vie : préparer une nouvelle édition à partir de celle-ci
// (copie de configuration, brouillon), et comparer / réparer une édition
// existante (cas 2027) de façon sélective.

import React, { useState } from "react";
import { Copy, GitCompare } from "lucide-react";
import { Button } from "./ui/Button";
import { adminFetch, newRequestId } from "../lib/adminFetch";
import type { DuplicationPreview, DuplicationResult } from "@/lib/server/events/duplicate";
import type { EditionComparison } from "@/lib/server/events/compare";
import type { WPTEvent } from "@/types/firestore";

const inputClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";

export function EditionTools({ event, events, onSelectEvent }: { event: WPTEvent; events: WPTEvent[]; onSelectEvent: (id: string) => void }) {
  const [mode, setMode] = useState<"none" | "duplicate" | "compare">("none");
  return (
    <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Éditions</h2>
        <p className="text-sm text-muted-foreground">Reprendre la configuration de « {event.name} » ou la comparer à une autre édition. Rien n&apos;est modifié sans aperçu.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant={mode === "duplicate" ? "default" : "outline"} onClick={() => setMode(mode === "duplicate" ? "none" : "duplicate")}>
          <Copy className="mr-2 h-4 w-4" /> Préparer une nouvelle édition à partir de celle-ci
        </Button>
        <Button variant={mode === "compare" ? "default" : "outline"} onClick={() => setMode(mode === "compare" ? "none" : "compare")}>
          <GitCompare className="mr-2 h-4 w-4" /> Comparer avec une autre édition
        </Button>
      </div>
      {mode === "duplicate" && <DuplicateWizard source={event} onDone={onSelectEvent} />}
      {mode === "compare" && <CompareEditions source={event} events={events.filter(other => other.id !== event.id)} />}
    </div>
  );
}

function DuplicateWizard({ source, onDone }: { source: WPTEvent; onDone: (id: string) => void }) {
  const [preview, setPreview] = useState<DuplicationPreview | null>(null);
  const [form, setForm] = useState({ name: "", eventYear: source.eventYear + 1, eventStartDate: "", eventEndDate: "", registrationDeadline: "" });
  const [days, setDays] = useState<string[]>([]);
  const [requestId] = useState(newRequestId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setBusy(true);
    try {
      const data = await adminFetch<DuplicationPreview>(`/api/admin/events/duplicate?sourceEventId=${encodeURIComponent(source.id)}`);
      setPreview(data);
      setDays(data.days.map(() => ""));
      setForm(previous => ({ ...previous, name: previous.name || source.name.replace(String(source.eventYear), String(source.eventYear + 1)) }));
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  if (!preview) {
    return <Button variant="secondary" disabled={busy} onClick={load}>{busy ? "Chargement…" : "Voir ce qui sera copié"}</Button>;
  }

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await adminFetch<DuplicationResult>("/api/admin/events/duplicate", {
        body: { sourceEventId: source.id, requestId, ...form, dayMapping: days.map(day => day || null) },
      });
      setMessage({ ok: true, text: `Édition créée en brouillon : ${result.categories} catégorie(s), ${result.products} produit(s), ${result.slots} créneau(x) libres. Vérifiez les prix « repris — à vérifier » et publiez les règlements avant d'ouvrir les inscriptions.` });
      onDone(result.eventId);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Nom<input className={inputClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
        <label className="grid gap-1 text-sm">Année<input className={inputClass} type="number" value={form.eventYear} onChange={event => setForm({ ...form, eventYear: Number(event.target.value) })} /></label>
        <label className="grid gap-1 text-sm">Début<input className={inputClass} type="date" value={form.eventStartDate} onChange={event => setForm({ ...form, eventStartDate: event.target.value })} /></label>
        <label className="grid gap-1 text-sm">Fin<input className={inputClass} type="date" value={form.eventEndDate} onChange={event => setForm({ ...form, eventEndDate: event.target.value })} /></label>
        <label className="grid gap-1 text-sm">Date limite d&apos;inscription<input className={inputClass} type="date" value={form.registrationDeadline} onChange={event => setForm({ ...form, registrationDeadline: event.target.value })} /></label>
      </div>

      <div>
        <p className="text-sm font-medium">Créneaux : nouvelle date de chaque journée (laisser vide pour ne pas générer)</p>
        <p className="text-xs text-muted-foreground">Horaires locaux (Europe/Paris), durées, pauses et capacités repris à l&apos;identique ; créneaux libres, sans participant.</p>
        <div className="mt-2 grid gap-2">
          {preview.days.map(day => (
            <label key={day.sourceDate} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_12rem]">
              <span>
                Jour {day.index + 1} — {day.sourceDate} : {day.slots} créneaux, {day.firstStart}–{day.lastEnd} ({day.categories.join(", ")})
              </span>
              <input className={inputClass} type="date" aria-label={`Nouvelle date du jour ${day.index + 1}`} value={days[day.index] ?? ""} onChange={event => setDays(previous => previous.map((value, index) => (index === day.index ? event.target.value : value)))} />
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="font-medium">Copié (tarifs « repris de {preview.source.eventYear} — à vérifier »)</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {preview.categories.map(category => (
              <li key={category.id}>
                {category.name} — {category.unitPrice} €{category.participantsPerSlot > 1 ? ` · équipe de ${category.participantsPerSlot}` : ""} · règlement {category.rulesVersion ? `v${category.rulesVersion} (à republier)` : "non publié"}
              </li>
            ))}
            {preview.products.map(product => (
              <li key={product.id}>
                {product.name} — {product.unitAmount} € · {product.slotsRequired} créneaux{product.mealsIncluded ? ` · ${product.mealsIncluded} repas` : ""}
                {product.excludedCategoryNames.length ? ` · hors ${product.excludedCategoryNames.join(", ")}` : ""}
              </li>
            ))}
            <li>Repas : {preview.mealPrice} € · minimum {preview.minSlotsPerBooking ?? 2} catégories</li>
          </ul>
        </div>
        <div>
          <p className="font-medium">Jamais copié</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">{preview.notCopied.map(item => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>

      {message && <p className={`text-sm ${message.ok ? "text-green-700" : "text-red-700"}`} role="status">{message.text}</p>}
      <Button disabled={busy || !form.name || !form.eventStartDate || !form.eventEndDate || !form.registrationDeadline} onClick={submit}>
        {busy ? "Création…" : "Créer l'édition en brouillon"}
      </Button>
    </div>
  );
}

function CompareEditions({ source, events }: { source: WPTEvent; events: WPTEvent[] }) {
  const [targetId, setTargetId] = useState(events[0]?.id ?? "");
  const [comparison, setComparison] = useState<EditionComparison | null>(null);
  const [copyIds, setCopyIds] = useState<string[]>([]);
  const [remapIds, setRemapIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setMessage(null);
    try {
      const data = await adminFetch<EditionComparison>(`/api/admin/events/compare?source=${encodeURIComponent(source.id)}&target=${encodeURIComponent(targetId)}`);
      setComparison(data);
      setCopyIds([]);
      setRemapIds(data.products.filter(product => product.linksToOtherEdition.length).map(product => product.targetId!).filter(Boolean));
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    }
  };

  const repair = async () => {
    if (!window.confirm("Appliquer la réparation sélectionnée ? Les catégories ajoutées sont inactives et leurs prix « à vérifier » ; rien d'existant n'est écrasé.")) return;
    try {
      await adminFetch("/api/admin/events/repair", { body: { sourceId: source.id, targetId, copyCategoryIds: copyIds, remapProductIds: remapIds, reason: "Réparation sélective depuis le diagnostic" } });
      setMessage({ ok: true, text: "Réparation appliquée et tracée." });
      await load();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="space-y-4 rounded-md border p-4 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1">Édition à diagnostiquer
          <select className={inputClass} value={targetId} onChange={event => setTargetId(event.target.value)}>
            {events.map(other => <option key={other.id} value={other.id}>{other.name}</option>)}
          </select>
        </label>
        <Button variant="secondary" disabled={!targetId} onClick={load}>Comparer</Button>
      </div>
      {comparison && (
        <>
          <p>
            <strong>{comparison.target.name}</strong> ({comparison.target.status}) : {comparison.target.slots} créneau(x) dont {comparison.target.bookedSlots} occupé(s), {comparison.target.payments} paiement(s).
            {comparison.target.payments > 0 && " Des inscriptions existent : elles ne seront jamais modifiées."}
          </p>
          <ul className="grid gap-1">
            {comparison.checklist.map(item => (
              <li key={item.item}>{item.ok ? "✅" : "⚠️"} {item.item} — <span className="text-muted-foreground">{item.detail}</span></li>
            ))}
          </ul>
          {comparison.event.length > 0 && <p className="text-muted-foreground">Paramètres différents : {comparison.event.join(" · ")}</p>}
          <table className="w-full">
            <thead className="text-left"><tr><th className="py-1">Catégorie</th><th>État</th><th>Différences</th><th>Reprendre</th></tr></thead>
            <tbody>
              {comparison.categories.map(category => (
                <tr key={`${category.name}-${category.status}`} className="border-t">
                  <td className="py-1">{category.name}</td>
                  <td>{{ same: "identique", different: "différente", missing_in_target: "manquante", only_in_target: "ajoutée" }[category.status]}</td>
                  <td className="text-muted-foreground">{category.differences.join(" · ")}</td>
                  <td>
                    {category.status === "missing_in_target" && (
                      <input type="checkbox" aria-label={`Reprendre ${category.name}`} checked={copyIds.includes(category.sourceId!)} onChange={event => setCopyIds(previous => (event.target.checked ? [...previous, category.sourceId!] : previous.filter(id => id !== category.sourceId)))} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {comparison.products.some(product => product.linksToOtherEdition.length || product.unknownLinks.length || product.differences.length) && (
            <ul className="list-disc pl-5">
              {comparison.products.map(product => (
                <li key={`${product.name}-${product.status}`}>
                  {product.name} : {[...product.differences, product.linksToOtherEdition.length ? `${product.linksToOtherEdition.length} exclusion(s) liée(s) à ${source.name} (remappées si coché)` : "", product.unknownLinks.length ? `${product.unknownLinks.length} lien(s) inconnu(s)` : ""].filter(Boolean).join(" · ") || "identique"}
                </li>
              ))}
            </ul>
          )}
          <Button disabled={copyIds.length === 0 && remapIds.length === 0} onClick={repair}>Appliquer la réparation sélectionnée</Button>
        </>
      )}
      {message && <p className={message.ok ? "text-green-700" : "text-red-700"} role="status">{message.text}</p>}
    </div>
  );
}
