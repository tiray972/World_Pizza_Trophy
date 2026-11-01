"use client";

// Statut de l'édition : prérequis visibles, transitions autorisées seulement,
// changement fait par le serveur (contrôles et historique).

import React, { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "./ui/Button";
import { adminFetch } from "../lib/adminFetch";
import { allowedTransitions, EVENT_STATUS_LABELS } from "@/lib/domain/event-lifecycle";
import type { ReadinessItem } from "@/lib/server/events/lifecycle";
import type { EventStatus, WPTEvent } from "@/types/firestore";

const CONSEQUENCES: Partial<Record<EventStatus, string>> = {
  open: "Les inscriptions et paiements s'ouvrent dans le Booking.",
  closed: "Plus aucune nouvelle réservation ; les paiements déjà lancés sont finalisés.",
  completed: "Compétition terminée : saisie et publication des résultats.",
  archived:
    "Archiver : plus aucune vente ni réservation pour cette édition, qui disparaît du Booking. Rien n'est supprimé : comptes, paiements, factures, exports et résultats restent accessibles ; paiements tardifs et remboursements continuent d'être traités.",
};

export function EditionStatusPanel({ event }: { event: WPTEvent }) {
  const [readiness, setReadiness] = useState<ReadinessItem[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminFetch<{ readiness: ReadinessItem[] }>(`/api/admin/events/${event.id}/status`)
      .then(data => !cancelled && setReadiness(data.readiness))
      .catch(error => !cancelled && setMessage({ ok: false, text: error.message }));
    return () => {
      cancelled = true;
    };
  }, [event.id, event.status, version]);

  const act = useCallback(async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/events/${event.id}/status`, { body });
      setMessage({ ok: true, text: success });
      setVersion(value => value + 1);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }, [event.id]);

  const pricesToCheck = readiness.find(item => item.key === "prices" && !item.ok);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Activity className="h-4 w-4" /> Statut : {EVENT_STATUS_LABELS[event.status] ?? event.status}
      </div>
      <ul className="grid gap-1 text-sm">
        {readiness.map(item => (
          <li key={item.key}>
            {item.ok ? "✅" : item.required ? "⛔" : "⚠️"} {item.label} — <span className="text-muted-foreground">{item.detail}</span>
          </li>
        ))}
      </ul>
      {pricesToCheck && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Confirmez-vous avoir vérifié tous les tarifs repris (catégories et packs) ? Les prix actuels seront enregistrés dans l'historique.")) {
              act({ action: "confirm-prices" }, "Tarifs confirmés.");
            }
          }}
        >
          J&apos;ai vérifié les prix
        </Button>
      )}
      <div className="flex flex-wrap gap-2">
        {allowedTransitions(event.status).map(next => (
          <Button
            key={next}
            type="button"
            size="sm"
            variant={next === "archived" ? "outline" : "secondary"}
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Passer à « ${EVENT_STATUS_LABELS[next]} » ?\n\n${CONSEQUENCES[next] ?? ""}`)) return;
              act({ to: next, expectedStatus: event.status }, `Statut : ${EVENT_STATUS_LABELS[next]}.`);
            }}
          >
            → {EVENT_STATUS_LABELS[next]}
          </Button>
        ))}
      </div>
      {message && <p className={`text-sm ${message.ok ? "text-green-700" : "text-red-700"}`} role="status">{message.text}</p>}
    </div>
  );
}
