"use client";
import React, { useMemo, useState } from "react";
import { Button } from "./ui/Button";
import { Slot, Category, User, Participant } from "@/types/firestore";
import { Gift, Loader2, Search, Sparkles, X, Wand2 } from "lucide-react";
import { formatTime, formatUser } from "../lib/utils";
import { getParticipantsPerSlot, getSlotParticipants } from "@/lib/booking/rules";
import {
  CandidateSlot,
  conflictsWithBreak,
  firstConflict,
  placeForParticipant,
  planOffers,
  PlacementRequest,
  TimeInterval,
} from "@/lib/booking/scheduler";

export interface SlotOffer {
  slotId: string;
  buyerId: string;
  participant: Participant;
  label?: string;
}

interface ParticipantMatrixProps {
  slots: Slot[];
  categories: Category[];
  users: User[];
  onOfferSlots: (offers: SlotOffer[]) => Promise<void>;
}

interface MatrixRow {
  key: string;
  participant: Participant;
  buyerId: string | null;
  slotsByCategory: Map<string, Slot[]>;
  busy: TimeInterval[];
}

/** Proposition en cours d'examen : participant -> catégorie -> créneau choisi. */
type ProposalState = Record<
  string,
  { choices: Record<string, string | null>; unplaced: { categoryId: string; reason: string }[] }
>;

const participantKey = (participant: Participant) =>
  [
    participant.firstName.trim().toLowerCase(),
    participant.lastName.trim().toLowerCase(),
    participant.email?.trim().toLowerCase() || "",
  ].join("|");

const shortDate = (date: string) => {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
};

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
  offered: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700",
  locked: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
};

export function ParticipantMatrix({ slots, categories, users, onOfferSlots }: ParticipantMatrixProps) {
  const [search, setSearch] = useState("");
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [proposal, setProposal] = useState<ProposalState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userMap = useMemo(() => Object.fromEntries(users.map(user => [user.id, user])), [users]);
  const categoryName = (categoryId: string) =>
    categories.find(category => category.id === categoryId)?.name || categoryId;

  // Créneaux libres, au format attendu par l'algorithme de placement
  const availableSlots: CandidateSlot[] = useMemo(
    () =>
      slots
        .filter(slot => slot.status === "available")
        .map(slot => ({
          id: slot.id,
          categoryId: slot.categoryId,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
    [slots]
  );

  // Une ligne par participant réel (duo compris), avec ses passages existants
  const rows: MatrixRow[] = useMemo(() => {
    const byKey = new Map<string, MatrixRow>();
    for (const slot of slots) {
      for (const participant of getSlotParticipants(slot)) {
        const key = participantKey(participant);
        const row =
          byKey.get(key) ??
          ({
            key,
            participant,
            buyerId: null,
            slotsByCategory: new Map<string, Slot[]>(),
            busy: [],
          } as MatrixRow);

        if (!row.buyerId && slot.buyerId) row.buyerId = slot.buyerId;
        const list = row.slotsByCategory.get(slot.categoryId) ?? [];
        list.push(slot);
        row.slotsByCategory.set(slot.categoryId, list);
        row.busy.push({
          start: slot.startTime,
          end: slot.endTime,
          label: `${categoryName(slot.categoryId)} ${formatTime(slot.startTime)}`,
        });
        byKey.set(key, row);
      }
    }
    return Array.from(byKey.values()).sort(
      (a, b) =>
        a.participant.lastName.localeCompare(b.participant.lastName) ||
        a.participant.firstName.localeCompare(b.participant.firstName)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, categories]);

  const filteredRows = rows.filter(row => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    const buyer = row.buyerId ? userMap[row.buyerId] : null;
    return [row.participant.firstName, row.participant.lastName, row.participant.email, buyer ? formatUser(buyer) : ""]
      .some(value => (value || "").toLowerCase().includes(needle));
  });

  const freeCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const slot of availableSlots) counts[slot.categoryId] = (counts[slot.categoryId] || 0) + 1;
    return counts;
  }, [availableSlots]);

  /** Créneaux libres de la catégorie compatibles avec l'agenda de la personne. */
  const compatibleSlots = (row: MatrixRow, categoryId: string) =>
    availableSlots.filter(
      slot => slot.categoryId === categoryId && !firstConflict(slot, row.busy, breakMinutes)
    );

  const toggleCell = (row: MatrixRow, categoryId: string) => {
    setSelected(previous => {
      const current = previous[row.key] ?? [];
      const next = current.includes(categoryId)
        ? current.filter(id => id !== categoryId)
        : [...current, categoryId];
      const updated = { ...previous, [row.key]: next };
      if (next.length === 0) delete updated[row.key];
      return updated;
    });
  };

  const selectionCount = Object.values(selected).reduce((sum, list) => sum + list.length, 0);

  const buildRequest = (row: MatrixRow): PlacementRequest => ({
    key: row.key,
    busy: row.busy,
    categoryIds: selected[row.key] ?? [],
  });

  const openProposal = (targetRows: MatrixRow[]) => {
    const requests = targetRows.filter(row => (selected[row.key] ?? []).length > 0).map(buildRequest);
    if (requests.length === 0) return;

    const results =
      requests.length === 1
        ? [placeForParticipant(requests[0], availableSlots, breakMinutes)]
        : planOffers(requests, availableSlots, breakMinutes);

    const state: ProposalState = {};
    for (const result of results) {
      const choices: Record<string, string | null> = {};
      for (const categoryId of requests.find(request => request.key === result.key)!.categoryIds) {
        choices[categoryId] = result.assignments.find(entry => entry.categoryId === categoryId)?.slot.id ?? null;
      }
      state[result.key] = { choices, unplaced: result.unplaced };
    }
    setProposal(state);
  };

  // ---------- Vérifications pendant l'édition de la proposition ----------

  const slotById = useMemo(() => new Map(availableSlots.map(slot => [slot.id, slot])), [availableSlots]);

  /** Raison pour laquelle un créneau ne peut pas être choisi (ou null s'il est possible). */
  const optionBlocker = (rowKey: string, categoryId: string, slot: CandidateSlot): string | null => {
    if (!proposal) return null;
    const row = rows.find(candidate => candidate.key === rowKey);
    if (!row) return null;

    // Déjà proposé à quelqu'un d'autre (ou pour une autre catégorie)
    for (const [otherKey, entry] of Object.entries(proposal)) {
      for (const [otherCategory, otherSlotId] of Object.entries(entry.choices)) {
        if (otherSlotId === slot.id && !(otherKey === rowKey && otherCategory === categoryId)) {
          return "déjà proposé ailleurs";
        }
      }
    }

    const conflict = firstConflict(slot, row.busy, breakMinutes);
    if (conflict) return `trop proche de ${conflict.label}`;

    const others = Object.entries(proposal[rowKey].choices)
      .filter(([otherCategory, otherSlotId]) => otherCategory !== categoryId && otherSlotId)
      .map(([otherCategory, otherSlotId]) => ({ categoryId: otherCategory, slot: slotById.get(otherSlotId!)! }))
      .filter(entry => entry.slot);

    const clash = others.find(entry =>
      conflictsWithBreak(
        { start: slot.startTime, end: slot.endTime },
        { start: entry.slot.startTime, end: entry.slot.endTime },
        breakMinutes
      )
    );
    if (clash) return `trop proche de ${categoryName(clash.categoryId)} ${formatTime(clash.slot.startTime)}`;
    return null;
  };

  const proposalOffers: SlotOffer[] = proposal
    ? Object.entries(proposal).flatMap(([rowKey, entry]) => {
        const row = rows.find(candidate => candidate.key === rowKey);
        if (!row || !row.buyerId) return [];
        return Object.entries(entry.choices)
          .filter(([, slotId]) => !!slotId)
          .map(([categoryId, slotId]) => {
            const slot = slotById.get(slotId!);
            return {
              slotId: slotId!,
              buyerId: row.buyerId!,
              participant: row.participant,
              label: `${row.participant.firstName} ${row.participant.lastName} — ${categoryName(categoryId)} ${slot ? `${shortDate(slot.date)} ${formatTime(slot.startTime)}` : ""}`,
            };
          });
      })
    : [];

  const proposalHasBlockers = proposal
    ? Object.entries(proposal).some(([rowKey, entry]) =>
        Object.entries(entry.choices).some(([categoryId, slotId]) => {
          const slot = slotId ? slotById.get(slotId) : null;
          return slot ? !!optionBlocker(rowKey, categoryId, slot) : false;
        })
      )
    : false;

  const confirmProposal = async () => {
    if (proposalOffers.length === 0 || proposalHasBlockers) return;
    setIsSubmitting(true);
    try {
      await onOfferSlots(proposalOffers);
      // Les lignes servies sortent de la sélection
      setSelected(previous => {
        const updated = { ...previous };
        Object.keys(proposal ?? {}).forEach(key => delete updated[key]);
        return updated;
      });
      setProposal(null);
    } catch (error) {
      console.error("❌ Offre impossible:", error);
      alert(
        "Les créneaux n'ont pas pu être offerts. Rien n'a été modifié.\n\n" +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------- Rendu ----------------------------------

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un participant..."
            className="h-9 w-64 rounded-md border border-input bg-background pl-8 pr-3 text-sm"
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="breakMinutes" className="text-xs font-medium text-muted-foreground">
            Pause minimum entre deux passages
          </label>
          <div className="flex items-center gap-2">
            <input
              id="breakMinutes"
              type="number"
              min={0}
              step={5}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(Math.max(0, Number(e.target.value) || 0))}
              className="h-9 w-20 rounded-md border border-input bg-background px-3 text-sm"
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </div>

        {/* Toujours affiché : la barre ne change jamais de taille quand on sélectionne */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {selectionCount === 0
              ? "Aucune sélection"
              : `${selectionCount} catégorie(s) · ${Object.keys(selected).length} participant(s)`}
          </span>
          <Button variant="outline" size="sm" onClick={() => setSelected({})} disabled={selectionCount === 0}>
            Tout effacer
          </Button>
          <Button
            onClick={() => openProposal(rows)}
            disabled={selectionCount === 0}
            title="Placer automatiquement toutes les catégories sélectionnées, sans chevauchement et avec la pause demandée"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Répartir automatiquement
          </Button>
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className={`rounded border px-2 py-0.5 ${STATUS_STYLES.paid}`}>Payé</span>
        <span className={`rounded border px-2 py-0.5 ${STATUS_STYLES.offered}`}>Offert</span>
        <span className={`rounded border px-2 py-0.5 ${STATUS_STYLES.locked}`}>Paiement en cours</span>
        <span className="rounded border border-blue-400 bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          ✓ À offrir
        </span>
        <span className="rounded border bg-muted px-2 py-0.5 opacity-60">Aucun créneau compatible</span>
        <span>· Cliquez sur une case vide pour la sélectionner</span>
      </div>

      {/* Tableau */}
      <div className="rounded-lg border overflow-auto max-h-[70vh]">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 bg-gray-100 dark:bg-zinc-800 border px-3 py-2 text-left text-xs font-semibold min-w-[220px]">
                Participant ({filteredRows.length})
              </th>
              {categories.map(category => (
                <th
                  key={category.id}
                  className="bg-gray-100 dark:bg-zinc-800 border px-2 py-2 text-xs font-semibold text-center min-w-[110px]"
                >
                  <div className="truncate" title={category.name}>{category.name}</div>
                  <div
                    className={`text-[10px] font-normal ${
                      (freeCountByCategory[category.id] || 0) === 0 ? "text-red-500" : "text-muted-foreground"
                    }`}
                  >
                    {freeCountByCategory[category.id] || 0} libre(s)
                    {getParticipantsPerSlot(category) > 1 ? " · 👥 duo" : ""}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={categories.length + 1} className="py-10 text-center text-muted-foreground">
                  Aucun participant inscrit pour l&apos;instant.
                </td>
              </tr>
            ) : (
              filteredRows.map(row => {
                const rowSelection = selected[row.key] ?? [];
                const buyer = row.buyerId ? userMap[row.buyerId] : null;

                return (
                  <tr key={row.key} className="hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-card border px-3 py-2 align-top">
                      <div className="font-medium">
                        {row.participant.firstName} {row.participant.lastName}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {row.busy.length} passage(s)
                        {buyer ? ` · acheteur : ${formatUser(buyer)}` : ""}
                      </div>
                      {/* Place réservée même sans sélection : pas de saut de ligne au clic */}
                      <Button
                        size="sm"
                        className={`mt-1 h-7 text-xs ${rowSelection.length === 0 ? "invisible" : ""}`}
                        onClick={() => openProposal([row])}
                        disabled={!row.buyerId || rowSelection.length === 0}
                        title={!row.buyerId ? "Aucun compte acheteur rattaché à ce participant" : undefined}
                        tabIndex={rowSelection.length === 0 ? -1 : 0}
                      >
                        <Sparkles className="mr-1 h-3 w-3" />
                        Proposer {Math.max(rowSelection.length, 1)} créneau(x)
                      </Button>
                    </td>

                    {categories.map(category => {
                      const existing = row.slotsByCategory.get(category.id) ?? [];
                      if (existing.length > 0) {
                        return (
                          <td key={category.id} className="border px-1 py-1 align-top">
                            {existing.map(slot => (
                              <div
                                key={slot.id}
                                className={`mb-0.5 rounded border px-1.5 py-0.5 text-[11px] text-center ${STATUS_STYLES[slot.status] || ""}`}
                                title={`${category.name} — ${slot.date} ${formatTime(slot.startTime)} (${slot.status})`}
                              >
                                {shortDate(slot.date)} {formatTime(slot.startTime)}
                              </div>
                            ))}
                          </td>
                        );
                      }

                      const isSelected = rowSelection.includes(category.id);
                      const compatible = compatibleSlots(row, category.id);
                      const blocked = compatible.length === 0;

                      return (
                        <td key={category.id} className="border p-0 align-middle">
                          <button
                            type="button"
                            disabled={blocked && !isSelected}
                            onClick={() => toggleCell(row, category.id)}
                            title={
                              blocked
                                ? (freeCountByCategory[category.id] || 0) === 0
                                  ? "Plus aucun créneau libre dans cette catégorie"
                                  : "Tous les créneaux libres tombent pendant un autre passage de cette personne"
                                : isSelected
                                  ? "Cliquer pour retirer"
                                  : `${compatible.length} créneau(x) compatible(s) — cliquer pour offrir`
                            }
                            className={`h-full min-h-[34px] w-full text-xs transition-colors ${
                              isSelected
                                ? "bg-blue-50 text-blue-700 font-semibold border-2 border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
                                : blocked
                                  ? "bg-muted/60 text-muted-foreground/40 cursor-not-allowed"
                                  : "text-muted-foreground/40 hover:bg-blue-50/60 hover:text-blue-600 dark:hover:bg-blue-950/20"
                            }`}
                          >
                            {isSelected ? "✓ à offrir" : blocked ? "—" : "+"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Proposition de placement : c'est l'écran de confirmation */}
      {proposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !isSubmitting && setProposal(null)} />
          <div className="fixed z-50 grid w-full max-w-3xl gap-4 border bg-card p-6 shadow-lg sm:rounded-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Gift className="h-5 w-5 text-purple-500" />
                Créneaux proposés
              </h2>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setProposal(null)} disabled={isSubmitting}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Placement automatique sur des créneaux libres, sans chevauchement, avec au moins{" "}
              <strong>{breakMinutes} min</strong> entre deux passages. Vous pouvez changer un créneau :
              les horaires incompatibles sont grisés. Rien n&apos;est enregistré avant la confirmation.
            </p>

            <div className="space-y-4">
              {Object.entries(proposal).map(([rowKey, entry]) => {
                const row = rows.find(candidate => candidate.key === rowKey);
                if (!row) return null;

                return (
                  <div key={rowKey} className="rounded-lg border p-3">
                    <p className="font-semibold mb-2">
                      {row.participant.firstName} {row.participant.lastName}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        déjà inscrit : {Array.from(row.slotsByCategory.keys()).map(categoryName).join(", ") || "—"}
                      </span>
                    </p>

                    <div className="space-y-2">
                      {Object.entries(entry.choices).map(([categoryId, slotId]) => {
                        const category = categories.find(candidate => candidate.id === categoryId);
                        const options = availableSlots
                          .filter(slot => slot.categoryId === categoryId)
                          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
                        const chosen = slotId ? slotById.get(slotId) : null;
                        const blocker = chosen ? optionBlocker(rowKey, categoryId, chosen) : null;

                        return (
                          <div key={categoryId} className="flex flex-wrap items-center gap-2">
                            <span className="w-40 text-sm font-medium truncate">{categoryName(categoryId)}</span>
                            <select
                              value={slotId ?? ""}
                              onChange={(e) =>
                                setProposal(previous =>
                                  previous
                                    ? {
                                        ...previous,
                                        [rowKey]: {
                                          ...previous[rowKey],
                                          choices: { ...previous[rowKey].choices, [categoryId]: e.target.value || null },
                                        },
                                      }
                                    : previous
                                )
                              }
                              className={`h-9 flex-1 min-w-[220px] rounded-md border bg-background px-2 text-sm ${
                                blocker ? "border-red-400" : "border-input"
                              }`}
                            >
                              <option value="">— Ne pas offrir —</option>
                              {options.map(option => {
                                const optionBlock = optionBlocker(rowKey, categoryId, option);
                                return (
                                  <option key={option.id} value={option.id} disabled={!!optionBlock && option.id !== slotId}>
                                    {shortDate(option.date)} {formatTime(option.startTime)}–{formatTime(option.endTime)}
                                    {optionBlock ? `  (indisponible : ${optionBlock})` : ""}
                                  </option>
                                );
                              })}
                            </select>
                            {blocker && <span className="text-xs text-red-600">⚠️ {blocker}</span>}
                            {!slotId && entry.unplaced.find(item => item.categoryId === categoryId) && (
                              <span className="text-xs text-amber-600">
                                {entry.unplaced.find(item => item.categoryId === categoryId)!.reason}
                              </span>
                            )}
                            {category && getParticipantsPerSlot(category) > 1 && slotId && (
                              <span className="text-xs text-blue-600">
                                👥 catégorie en équipe : complétez le coéquipier via « Reassign »
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground sm:mr-auto">
                {proposalOffers.length} créneau(x) seront marqués <strong>offerts</strong>
                {proposalHasBlockers ? " — corrigez les conflits en rouge" : ""}
              </span>
              <Button variant="outline" onClick={() => setProposal(null)} disabled={isSubmitting}>
                Annuler
              </Button>
              <Button
                onClick={confirmProposal}
                disabled={proposalOffers.length === 0 || proposalHasBlockers || isSubmitting}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                Confirmer et offrir {proposalOffers.length} créneau(x)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
