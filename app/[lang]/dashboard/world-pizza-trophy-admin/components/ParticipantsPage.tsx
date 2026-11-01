"use client";

// Participants et équipes d'une édition. Corriger un nom ici le corrige
// partout où cette identité est utilisée (créneaux, équipes, places repas,
// exports, programme) ; paiements et factures ne sont jamais modifiés.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, History, Pencil, RefreshCw, UserPlus, Users } from "lucide-react";
import { Button } from "./ui/Button";
import { adminFetch, AdminRequestError, newRequestId } from "../lib/adminFetch";
import { displayName } from "@/lib/domain/names";
import type { IdentityOverview } from "@/lib/server/participants/overview";
import type { WPTEvent } from "@/types/firestore";

type Participant = IdentityOverview["participants"][number];
type Team = IdentityOverview["teams"][number];

type ModalState =
  | { kind: "rename"; participant: Participant }
  | { kind: "bib"; holderType: "participant" | "team"; id: string; label: string; bib: number | null; version: number }
  | { kind: "team"; team: Team }
  | { kind: "create" }
  | { kind: "history"; entityId: string; label: string }
  | null;

const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 grid max-h-[90vh] w-full max-w-lg gap-4 overflow-y-auto rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ParticipantsPage({ selectedEvent }: { selectedEvent?: WPTEvent }) {
  const [data, setData] = useState<IdentityOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedEvent) return;
    setLoading(true);
    setError(null);
    try {
      setData(await adminFetch<IdentityOverview>(`/api/admin/participants?eventId=${encodeURIComponent(selectedEvent.id)}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    load();
  }, [load]);

  const byId = useMemo(() => new Map((data?.participants ?? []).map(participant => [participant.id, participant])), [data]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = data?.participants ?? [];
    if (!query) return list;
    return list.filter(participant => participant.displayName.toLowerCase().includes(query) || String(participant.bib ?? "") === query);
  }, [data, search]);

  /** Exécute une action puis recharge ; un conflit de version est expliqué. */
  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      setModal(null);
      setNotice(success);
      await load();
    } catch (actionError) {
      if (actionError instanceof AdminRequestError && actionError.code === "version_conflict") {
        await load();
      }
      throw actionError;
    }
  };

  if (!selectedEvent) return <p className="text-muted-foreground">Sélectionnez une édition.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Participants et équipes</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Identités sportives de l&apos;édition, distinctes des comptes acheteurs. Une correction de nom s&apos;applique aux créneaux,
            équipes, places repas, listes de présence, programmes et exports. Les paiements et factures ne sont jamais modifiés.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </Button>
          <Button onClick={() => setModal({ kind: "create" })}>
            <UserPlus className="mr-2 h-4 w-4" /> Ajouter un participant
          </Button>
        </div>
      </div>

      {error && <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && (
        <p className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800" role="status">
          {notice}
        </p>
      )}

      {data && data.legacySlots.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center font-semibold">
            <AlertTriangle className="mr-2 h-4 w-4" /> {data.legacySlots.length} créneau(x) réservé(s) avant ce système n&apos;ont pas encore d&apos;identité.
          </p>
          <p className="mt-1">
            Leurs noms restent affichés tels quels mais ne peuvent pas être corrigés ici tant que la migration de l&apos;édition
            n&apos;a pas été validée et appliquée (simulation : <code>scripts/migrations/2026-identities.ts</code>).
          </p>
        </div>
      )}

      {data && data.possibleDuplicates.length > 0 && (
        <div className="rounded-md border p-4 text-sm">
          <p className="font-semibold">Doublons possibles (jamais fusionnés automatiquement)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {data.possibleDuplicates.map(group => (
              <li key={group.key}>
                {group.participantIds.map(id => byId.get(id)?.displayName ?? id).join(" · ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Participants ({data?.participants.length ?? 0})</h2>
          <input
            className={`${inputClass} max-w-xs`}
            placeholder="Rechercher un nom ou un dossard"
            aria-label="Rechercher un participant"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Dossard</th>
                <th className="px-3 py-2">Participant</th>
                <th className="px-3 py-2">Inscriptions</th>
                <th className="px-3 py-2">Acheteur(s)</th>
                <th className="px-3 py-2">Repas</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(participant => (
                <tr key={participant.id} className={`border-t align-top ${participant.withdrawn ? "opacity-60" : ""}`}>
                  <td className="px-3 py-2 font-mono">{participant.bib ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{participant.displayName}</span>
                    {participant.withdrawn && <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700">retiré</span>}
                    {participant.createdFrom !== "checkout" && (
                      <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">{participant.createdFrom === "admin" ? "ajout admin" : participant.createdFrom}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {participant.entries.length === 0
                      ? "—"
                      : participant.entries.map(entry => `${entry.categoryName} (${entry.date})`).join(", ")}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{participant.buyers.map(buyer => buyer.label).join(", ") || "—"}</td>
                  <td className="px-3 py-2">{participant.mealSeats || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setModal({ kind: "rename", participant })}>
                      <Pencil className="mr-1 h-3 w-3" /> Nom
                    </Button>{" "}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModal({ kind: "bib", holderType: "participant", id: participant.id, label: participant.displayName, bib: participant.bib, version: participant.version })}
                    >
                      Dossard
                    </Button>{" "}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        run(
                          () => adminFetch(`/api/admin/participants/${participant.id}`, { method: "PATCH", body: { action: "withdraw", withdrawn: !participant.withdrawn, expectedVersion: participant.version, reason: participant.withdrawn ? "Réintégré" : "Retiré du planning" } }),
                          participant.withdrawn ? "Participant réintégré." : "Participant retiré des listes (historique conservé)."
                        ).catch(actionError => setError(actionError.message))
                      }
                    >
                      {participant.withdrawn ? "Réintégrer" : "Retirer"}
                    </Button>{" "}
                    <Button size="sm" variant="ghost" aria-label={`Historique de ${participant.displayName}`} onClick={() => setModal({ kind: "history", entityId: participant.id, label: participant.displayName })}>
                      <History className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    {loading ? "Chargement…" : "Aucun participant."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center text-lg font-semibold">
          <Users className="mr-2 h-5 w-5" /> Équipes ({data?.teams.length ?? 0})
        </h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Dossard</th>
                <th className="px-3 py-2">Catégorie</th>
                <th className="px-3 py-2">Membres</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.teams ?? []).map(team => (
                <tr key={team.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{team.bib ?? "—"}</td>
                  <td className="px-3 py-2">{team.categoryName}</td>
                  <td className="px-3 py-2">
                    {team.memberIds.map(id => byId.get(id)?.displayName ?? id).join(" – ") || "—"}
                    {team.displayName && <span className="block text-xs text-muted-foreground">Nom publié : {team.displayName}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {team.status === "complete" ? (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">complète</span>
                    ) : (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                        incomplète ({team.memberIds.length}/{team.requiredMembers})
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setModal({ kind: "team", team })}>
                      Équipiers
                    </Button>{" "}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModal({ kind: "bib", holderType: "team", id: team.id, label: `Équipe ${team.categoryName}`, bib: team.bib, version: team.version })}
                    >
                      Dossard
                    </Button>
                  </td>
                </tr>
              ))}
              {(data?.teams.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Aucune équipe.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal?.kind === "rename" && <RenameModal participant={modal.participant} onClose={() => setModal(null)} run={run} />}
      {modal?.kind === "bib" && <BibModal state={modal} onClose={() => setModal(null)} run={run} />}
      {modal?.kind === "team" && data && <TeamModal team={modal.team} participants={data.participants} eventId={selectedEvent.id} onClose={() => setModal(null)} run={run} />}
      {modal?.kind === "create" && <CreateModal eventId={selectedEvent.id} onClose={() => setModal(null)} run={run} />}
      {modal?.kind === "history" && data && (
        <Modal title={`Historique — ${modal.label}`} onClose={() => setModal(null)}>
          <ul className="space-y-2 text-sm">
            {data.auditLog.filter(entry => entry.entityId === modal.entityId).map(entry => (
              <li key={entry.id} className="rounded border p-2">
                <p className="font-medium">{entry.action} · {entry.at ? new Date(entry.at).toLocaleString("fr-FR") : ""} · {entry.actorName ?? "?"}</p>
                <p className="text-xs text-muted-foreground">Avant : {JSON.stringify(entry.before)} → Après : {JSON.stringify(entry.after)}</p>
                {entry.reason && <p className="text-xs">Motif : {entry.reason}</p>}
              </li>
            ))}
            {data.auditLog.every(entry => entry.entityId !== modal.entityId) && <li className="text-muted-foreground">Aucune modification enregistrée.</li>}
          </ul>
          <Button variant="outline" onClick={() => setModal(null)}>Fermer</Button>
        </Modal>
      )}
    </div>
  );
}

type Run = (action: () => Promise<unknown>, success: string) => Promise<void>;

function useSubmit(run: Run) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await run(action, success);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

function RenameModal({ participant, onClose, run }: { participant: Participant; onClose: () => void; run: Run }) {
  const [firstName, setFirstName] = useState(participant.firstName);
  const [lastName, setLastName] = useState(participant.lastName);
  const [reason, setReason] = useState("");
  const { busy, error, submit } = useSubmit(run);
  const preview = displayName({ firstName, lastName });
  const impact = participant.entries.length;

  return (
    <Modal title={`Corriger le nom — ${participant.displayName}`} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={event => {
          event.preventDefault();
          submit(
            () => adminFetch(`/api/admin/participants/${participant.id}`, { method: "PATCH", body: { action: "rename", firstName, lastName, reason, expectedVersion: participant.version } }),
            `Nom corrigé : ${preview}.`
          );
        }}
      >
        <label className="grid gap-1 text-sm font-medium">
          NOM
          <input className={inputClass} value={lastName} onChange={event => setLastName(event.target.value)} required autoFocus />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Prénom
          <input className={inputClass} value={firstName} onChange={event => setFirstName(event.target.value)} required />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Motif (conservé dans l&apos;historique)
          <input className={inputClass} value={reason} onChange={event => setReason(event.target.value)} placeholder="ex. saisie fautive confirmée par le participant" />
        </label>
        <p className="rounded bg-muted/50 p-2 text-sm">
          Affichage : <strong>{preview || "—"}</strong>
          <span className="block text-xs text-muted-foreground">
            Sera reporté sur {impact} créneau(x), {participant.mealSeats} place(s) repas et les équipes de ce participant. Dossard,
            inscriptions et paiements sont conservés.
          </span>
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Corriger le nom"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function BibModal({ state, onClose, run }: { state: Extract<ModalState, { kind: "bib" }>; onClose: () => void; run: Run }) {
  const [value, setValue] = useState(state.bib === null ? "" : String(state.bib));
  const [reason, setReason] = useState("");
  const { busy, error, submit } = useSubmit(run);
  const path = state.holderType === "team" ? `/api/admin/teams/${state.id}` : `/api/admin/participants/${state.id}`;

  return (
    <Modal title={`Dossard — ${state.label}`} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={event => {
          event.preventDefault();
          const bib = value.trim() === "" ? null : Number(value);
          submit(() => adminFetch(path, { method: "PATCH", body: { action: "bib", bib, reason, expectedVersion: state.version } }), bib === null ? "Dossard retiré." : `Dossard ${bib} attribué.`);
        }}
      >
        <p className="text-sm text-muted-foreground">
          Numéro unique dans l&apos;édition (individuels et équipes confondus). Un numéro déjà attribué est refusé : retirez-le d&apos;abord à son porteur.
          Laissez vide pour retirer le dossard.
        </p>
        <input className={inputClass} inputMode="numeric" pattern="[0-9]*" value={value} onChange={event => setValue(event.target.value)} aria-label="Numéro de dossard" autoFocus />
        <input className={inputClass} value={reason} onChange={event => setReason(event.target.value)} placeholder="Motif (facultatif)" aria-label="Motif" />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={busy}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

function TeamModal({ team, participants, eventId, onClose, run }: { team: Team; participants: Participant[]; eventId: string; onClose: () => void; run: Run }) {
  const [members, setMembers] = useState<string[]>(() => Array.from({ length: team.requiredMembers }, (_, index) => team.memberIds[index] ?? ""));
  const [reason, setReason] = useState("");
  const [newMember, setNewMember] = useState({ firstName: "", lastName: "" });
  const [requestId] = useState(newRequestId);
  const { busy, error, submit } = useSubmit(run);
  const firstEmpty = members.findIndex(member => !member);

  return (
    <Modal title={`Équipiers — ${team.categoryName}${team.bib ? ` n° ${team.bib}` : ""}`} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={event => {
          event.preventDefault();
          submit(
            () => adminFetch(`/api/admin/teams/${team.id}`, { method: "PATCH", body: { action: "members", memberIds: members.filter(Boolean), reason, expectedVersion: team.version } }),
            "Équipe mise à jour : le créneau et le paiement de l'équipe sont inchangés."
          );
        }}
      >
        {members.map((member, index) => (
          <label key={index} className="grid gap-1 text-sm font-medium">
            Équipier {index + 1}
            <select
              className={inputClass}
              value={member}
              onChange={event => setMembers(previous => previous.map((value, current) => (current === index ? event.target.value : value)))}
            >
              <option value="">— à compléter —</option>
              {participants.map(participant => (
                <option key={participant.id} value={participant.id}>
                  {participant.displayName}{participant.bib ? ` (n° ${participant.bib})` : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
        {firstEmpty >= 0 && (
          <fieldset className="grid gap-2 rounded border p-3">
            <legend className="px-1 text-sm font-medium">Équipier absent de la liste</legend>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} placeholder="NOM" aria-label="Nom du nouvel équipier" value={newMember.lastName} onChange={event => setNewMember(previous => ({ ...previous, lastName: event.target.value }))} />
              <input className={inputClass} placeholder="Prénom" aria-label="Prénom du nouvel équipier" value={newMember.firstName} onChange={event => setNewMember(previous => ({ ...previous, firstName: event.target.value }))} />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !newMember.firstName.trim() || !newMember.lastName.trim()}
              onClick={() =>
                submit(async () => {
                  const created = await adminFetch<{ participantId: string }>("/api/admin/participants", {
                    body: { eventId, firstName: newMember.firstName, lastName: newMember.lastName, requestId, reason: `Équipier de l'équipe ${team.id}` },
                  });
                  const next = members.map((value, index) => (index === firstEmpty ? created.participantId : value));
                  await adminFetch(`/api/admin/teams/${team.id}`, { method: "PATCH", body: { action: "members", memberIds: next.filter(Boolean), reason, expectedVersion: team.version } });
                }, "Équipier créé et ajouté à l'équipe.")
              }
            >
              Créer et ajouter à l&apos;équipe
            </Button>
          </fieldset>
        )}
        <input className={inputClass} value={reason} onChange={event => setReason(event.target.value)} placeholder="Motif (ex. feuille de résultats officielle)" aria-label="Motif" />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={busy}>Enregistrer l&apos;équipe</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateModal({ eventId, onClose, run }: { eventId: string; onClose: () => void; run: Run }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", note: "" });
  const [requestId] = useState(newRequestId);
  const { busy, error, submit } = useSubmit(run);

  return (
    <Modal title="Ajouter un participant" onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={event => {
          event.preventDefault();
          submit(() => adminFetch("/api/admin/participants", { body: { eventId, ...form, requestId } }), `Participant ${displayName(form)} ajouté.`);
        }}
      >
        <p className="text-sm text-muted-foreground">
          Pour un ajout tardif ou un équipier manquant. Aucun créneau ni paiement n&apos;est créé : attribuez ensuite le dossard et, si besoin, l&apos;équipe.
        </p>
        <input className={inputClass} placeholder="NOM" aria-label="Nom" required value={form.lastName} onChange={event => setForm(previous => ({ ...previous, lastName: event.target.value }))} />
        <input className={inputClass} placeholder="Prénom" aria-label="Prénom" required value={form.firstName} onChange={event => setForm(previous => ({ ...previous, firstName: event.target.value }))} />
        <input className={inputClass} placeholder="Note (ex. ajout tardif, feuille de résultats)" aria-label="Note" value={form.note} onChange={event => setForm(previous => ({ ...previous, note: event.target.value }))} />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={busy}>Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}
