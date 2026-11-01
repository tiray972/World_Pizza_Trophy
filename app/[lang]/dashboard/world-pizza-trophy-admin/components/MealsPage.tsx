"use client";

// Repas : commandes groupées par acheteur et feuille de pointage (une ligne par
// place payée). Les places sans nom restent visibles « à compléter ».

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, RefreshCw, Download, AlertTriangle } from "lucide-react";
import { Button } from "./ui/Button";
import { adminFetch } from "../lib/adminFetch";
import { attendanceSheet, mealTotals, type MealAnomaly, type MealOrder } from "@/lib/domain/meals";
import { displayName } from "@/lib/domain/names";
import type { WPTEvent } from "@/types/firestore";

type Overview = { orders: (Omit<MealOrder, "createdAt"> & { createdAt: string | null })[]; anomalies: MealAnomaly[] };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

function download(filename: string, rows: (string | number)[][]) {
  const blob = new Blob(["﻿" + rows.map(row => row.map(csvCell).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

export function MealsPage({ selectedEvent }: { selectedEvent?: WPTEvent }) {
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<"orders" | "sheet">("orders");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ seatId: string; firstName: string; lastName: string } | null>(null);

  const load = useCallback(async () => {
    if (!selectedEvent) return;
    setLoading(true);
    setError(null);
    try {
      setData(await adminFetch<Overview>(`/api/admin/meals?eventId=${encodeURIComponent(selectedEvent.id)}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    load();
  }, [load]);

  const orders = useMemo<MealOrder[]>(
    () => (data?.orders ?? []).map(order => ({ ...order, createdAt: order.createdAt ? new Date(order.createdAt) : null })),
    [data]
  );
  const sheet = useMemo(() => attendanceSheet(orders), [orders]);
  const totals = useMemo(() => mealTotals(orders), [orders]);

  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    }
  };

  const printSheet = () => {
    const popup = window.open("", "_blank");
    if (!popup) return;
    const rows = sheet
      .map(row => `<tr><td class="box">☐</td><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.seatNumber)}</td><td>${escapeHtml(row.buyerLabel)}</td></tr>`)
      .join("");
    popup.document.write(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Pointage repas</title><style>body{font:12px system-ui,sans-serif;margin:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:6px;text-align:left}.box{width:28px;text-align:center;font-size:16px}</style></head><body>` +
        `<h1>${escapeHtml(selectedEvent?.name ?? "")} — pointage des repas</h1><p>${totals.paidSeats} places payées, dont ${totals.toComplete} à compléter. Une ligne par place.</p>` +
        `<table><thead><tr><th>Présent</th><th>Bénéficiaire</th><th>Place</th><th>Commande de</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
    );
    popup.document.close();
    popup.print();
  };

  if (!selectedEvent) return <p className="text-muted-foreground">Sélectionnez une édition.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Repas</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Une place par repas payé. Les places sans nom restent « à compléter » : aucun nom n&apos;est déduit de l&apos;acheteur.
            Les commandes remboursées ou non payées sont exclues du pointage.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      {error && <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Places payées", totals.paidSeats],
          ["Places nommées", totals.namedSeats],
          ["À compléter", totals.toComplete],
          ["Commandes / acheteurs", `${totals.orders} / ${totals.buyers}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      {data && data.anomalies.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center font-semibold"><AlertTriangle className="mr-2 h-4 w-4" /> Points à vérifier</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.anomalies.map((anomaly, index) => (
              <li key={index}>
                {anomaly.message} <span className="font-mono text-xs">{anomaly.stripeSessionId ?? anomaly.paymentId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="tablist">
        <Button variant={tab === "orders" ? "default" : "outline"} role="tab" aria-selected={tab === "orders"} onClick={() => setTab("orders")}>Commandes</Button>
        <Button variant={tab === "sheet" ? "default" : "outline"} role="tab" aria-selected={tab === "sheet"} onClick={() => setTab("sheet")}>Feuille de pointage</Button>
        <span className="flex-1" />
        {tab === "sheet" ? (
          <>
            <Button variant="outline" onClick={printSheet}><Printer className="mr-2 h-4 w-4" /> Imprimer</Button>
            <Button
              variant="outline"
              onClick={() =>
                download(`repas-pointage-${selectedEvent.eventYear}.csv`, [
                  ["Présent", "Bénéficiaire", "Place", "Commande de", "Référence"],
                  ...sheet.map(row => [row.present ? "oui" : "", row.label, row.seatNumber, row.buyerLabel, row.orderRef]),
                ])
              }
            >
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() =>
              download(`repas-commandes-${selectedEvent.eventYear}.csv`, [
                ["Acheteur", "Date", "Référence Stripe", "Facture", "Statut", "Places", "À compléter", "Bénéficiaires"],
                ...orders.map(order => [
                  order.buyerLabel,
                  order.createdAt ? order.createdAt.toLocaleString("fr-FR") : "",
                  order.stripeSessionId ?? order.paymentId,
                  order.invoiceNumber ?? "",
                  order.paymentStatus,
                  order.quantity,
                  order.toComplete,
                  order.seats.map(seat => (seat.beneficiary ? displayName(seat.beneficiary) : "à compléter")).join(" | "),
                ]),
              ])
            }
          >
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        )}
      </div>

      {tab === "orders" ? (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.paymentId} className="rounded-md border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{order.buyerLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {order.createdAt?.toLocaleString("fr-FR")} · {order.paymentStatus} · <span className="font-mono">{order.stripeSessionId ?? order.paymentId}</span>
                  {order.invoiceNumber ? ` · facture ${order.invoiceNumber}` : ""}
                  {order.isPack ? ` · pack ${order.packName ?? ""}` : ""}
                </p>
              </div>
              <p className="mt-1 text-sm">{order.quantity} place(s){order.toComplete ? `, dont ${order.toComplete} à compléter` : ""}</p>
              <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {order.seats.map(seat => (
                  <li key={seat.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1">
                    <span className={seat.beneficiary ? "" : "italic text-muted-foreground"}>
                      {seat.seatIndex + 1}. {seat.beneficiary ? displayName(seat.beneficiary) : "à compléter"}
                      {seat.financialStatus !== "paid" && <span className="ml-2 text-xs text-red-700">({seat.financialStatus})</span>}
                    </span>
                    {seat.derived ? null : (
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ seatId: seat.id, firstName: seat.beneficiary?.firstName ?? "", lastName: seat.beneficiary?.lastName ?? "" })}>
                        Nom
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
              {order.seats.some(seat => seat.derived) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => act(() => adminFetch("/api/admin/meals", { body: { action: "materialize", paymentId: order.paymentId, reason: "Compléter les bénéficiaires" } }))}
                >
                  Créer les places pour compléter les noms et pointer
                </Button>
              )}
            </div>
          ))}
          {orders.length === 0 && <p className="text-muted-foreground">{loading ? "Chargement…" : "Aucun repas pour cette édition."}</p>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr><th className="px-3 py-2">Présent</th><th className="px-3 py-2">Bénéficiaire</th><th className="px-3 py-2">Place</th><th className="px-3 py-2">Commande de</th></tr>
            </thead>
            <tbody>
              {sheet.map(row => (
                <tr key={row.seatId} className="border-t">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-5"
                      aria-label={`Présence : ${row.label}`}
                      checked={row.present}
                      disabled={row.derived}
                      title={row.derived ? "Créez d'abord les places de cette commande (onglet Commandes)." : undefined}
                      onChange={event => act(() => adminFetch(`/api/admin/meals/${row.seatId}`, { method: "PATCH", body: { present: event.target.checked } }))}
                    />
                  </td>
                  <td className={`px-3 py-2 ${row.named ? "font-medium" : "italic text-muted-foreground"}`}>{row.label}</td>
                  <td className="px-3 py-2">{row.seatNumber}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.buyerLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Bénéficiaire du repas">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <form
            className="relative z-10 grid w-full max-w-md gap-3 rounded-lg border bg-card p-6 shadow-lg"
            onSubmit={event => {
              event.preventDefault();
              const named = editing.firstName.trim() && editing.lastName.trim();
              act(() =>
                adminFetch(`/api/admin/meals/${editing.seatId}`, {
                  method: "PATCH",
                  body: { beneficiary: named ? { firstName: editing.firstName, lastName: editing.lastName } : null },
                })
              ).then(() => setEditing(null));
            }}
          >
            <h2 className="text-lg font-semibold">Bénéficiaire du repas</h2>
            <p className="text-sm text-muted-foreground">Laissez vide pour remettre la place « à compléter ».</p>
            <input className="h-10 rounded-md border bg-background px-3 text-sm" placeholder="NOM" aria-label="Nom" value={editing.lastName} onChange={event => setEditing({ ...editing, lastName: event.target.value })} autoFocus />
            <input className="h-10 rounded-md border bg-background px-3 text-sm" placeholder="Prénom" aria-label="Prénom" value={editing.firstName} onChange={event => setEditing({ ...editing, firstName: event.target.value })} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
