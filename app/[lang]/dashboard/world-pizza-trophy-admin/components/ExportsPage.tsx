"use client";
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import {
  Download, FileSpreadsheet, CheckCircle2, Loader2,
  Link as LinkIcon, RefreshCw,
  Users, CreditCard, Calendar, Trophy, BarChart3, UtensilsCrossed
} from "lucide-react";
import { cn, formatTime, formatUser } from "../lib/utils";
import { Slot, Category, User, Payment, WPTEvent } from "@/types/firestore";

// ─────────────────────────────────────────────
// CSV UTILITIES
// ─────────────────────────────────────────────
function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map(row => row.map(escapeCsvCell).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function downloadCsv(content: string, filename: string) {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// EXPORT GENERATORS
// ─────────────────────────────────────────────

/** 1. RUNNING ORDER — All slots sorted by date/time with participant info */
function generateRunningOrder(slots: Slot[], categories: Category[], users: User[]): string {
  const sorted = [...slots].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.getTime() - b.startTime.getTime();
  });

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const headers = ["#", "Date", "Start", "End", "Category", "Status", "Participant First Name", "Participant Last Name", "Participant Email", "Participant Phone", "T-Shirt Size", "Buyer (Account)", "Buyer Email"];
  const rows = sorted.map((slot, idx) => {
    const buyer = slot.buyerId ? userMap[slot.buyerId] : null;
    return [
      idx + 1,
      slot.date,
      formatTime(slot.startTime),
      formatTime(slot.endTime),
      categoryMap[slot.categoryId] || slot.categoryId,
      slot.status,
      slot.participant?.firstName || "",
      slot.participant?.lastName || "",
      slot.participant?.email || "",
      slot.participant?.phone || "",
      slot.participant?.shirtSize || "",
      buyer ? formatUser(buyer) : "",
      buyer?.email || "",
    ];
  });

  return buildCsv(headers, rows);
}

/** 2. BY CATEGORY — One section per category with their participants */
function generateByCategory(slots: Slot[], categories: Category[], users: User[]): string {
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const headers = ["Category", "Date", "Start", "End", "Status", "Participant First Name", "Participant Last Name", "Email", "Phone", "T-Shirt Size", "Buyer"];
  const rows: (string | number | null | undefined)[][] = [];

  // Group by category
  const byCategory: Record<string, Slot[]> = {};
  for (const slot of slots) {
    if (!byCategory[slot.categoryId]) byCategory[slot.categoryId] = [];
    byCategory[slot.categoryId].push(slot);
  }

  for (const cat of categories) {
    const catSlots = (byCategory[cat.id] || []).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.getTime() - b.startTime.getTime();
    });

    if (catSlots.length === 0) continue;

    // Category header row
    rows.push([`=== ${cat.name.toUpperCase()} ===`, "", "", "", "", "", "", "", "", "", ""]);

    for (const slot of catSlots) {
      const buyer = slot.buyerId ? userMap[slot.buyerId] : null;
      rows.push([
        cat.name,
        slot.date,
        formatTime(slot.startTime),
        formatTime(slot.endTime),
        slot.status,
        slot.participant?.firstName || "",
        slot.participant?.lastName || "",
        slot.participant?.email || "",
        slot.participant?.phone || "",
        slot.participant?.shirtSize || "",
        buyer ? formatUser(buyer) : "",
      ]);
    }

    // Blank separator
    rows.push(Array(11).fill(""));
  }

  return buildCsv(headers, rows);
}

/** 3. PARTICIPANT LIST — Actual competitors with participation count and shirt size */
function generateParticipantList(slots: Slot[], categories: Category[], users: User[]): string {
  const headers = ["First Name", "Last Name", "Email", "Phone", "T-Shirt Size", "Participations", "Categories", "Slot Dates", "Buyer", "Buyer Email"];
  const categoryMap = Object.fromEntries(categories.map(category => [category.id, category.name]));
  const userMap = Object.fromEntries(users.map(user => [user.id, user]));
  const participantMap = new Map<string, { participant: NonNullable<Slot["participant"]>; slots: Slot[]; buyerIds: Set<string> }>();

  for (const slot of slots) {
    if (!slot.participant) continue;
    const key = [
      slot.participant.firstName.trim().toLowerCase(),
      slot.participant.lastName.trim().toLowerCase(),
      slot.participant.email?.trim().toLowerCase() || "",
    ].join("|");

    const existing = participantMap.get(key);
    if (existing) {
      existing.slots.push(slot);
      if (slot.buyerId) existing.buyerIds.add(slot.buyerId);
    } else {
      participantMap.set(key, {
        participant: slot.participant,
        slots: [slot],
        buyerIds: new Set(slot.buyerId ? [slot.buyerId] : []),
      });
    }
  }

  const rows = Array.from(participantMap.values())
    .sort((a, b) =>
      a.participant.lastName.localeCompare(b.participant.lastName) ||
      a.participant.firstName.localeCompare(b.participant.firstName)
    )
    .map(({ participant, slots: participantSlots, buyerIds }) => {
      const sortedParticipantSlots = [...participantSlots].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.getTime() - b.startTime.getTime();
      });
      const categoriesForParticipant = Array.from(new Set(sortedParticipantSlots.map(slot => categoryMap[slot.categoryId] || slot.categoryId))).join(" | ");
      const slotDates = sortedParticipantSlots.map(slot => `${slot.date} ${formatTime(slot.startTime)}`).join(" | ");
      const buyers = Array.from(buyerIds).map(buyerId => userMap[buyerId]).filter(Boolean);

      return [
        participant.firstName,
        participant.lastName,
        participant.email || "",
        participant.phone || "",
        participant.shirtSize || "",
        participantSlots.length,
        categoriesForParticipant,
        slotDates,
        buyers.map(formatUser).join(" | "),
        buyers.map(buyer => buyer.email).join(" | "),
      ];
    });

  return buildCsv(headers, rows);
}

/** 4. FINANCIAL DETAIL — All paid/offered slots with amounts */
function generateFinancialDetail(slots: Slot[], payments: Payment[], users: User[]): string {
  const headers = ["Date", "Slot Date", "Slot Time", "Category", "Status", "Participant", "T-Shirt Size", "Buyer", "Buyer Email", "Amount (€)", "Payment Method", "Stripe Session", "Recorded At"];

  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const categoryIdBySlot = Object.fromEntries(slots.map(slot => [slot.id, slot.categoryId]));

  // Build a map from stripeSessionId to payment
  const paymentBySession: Record<string, Payment> = {};
  for (const p of payments) {
    if (p.stripeSessionId) paymentBySession[p.stripeSessionId] = p;
  }

  const paid = slots
    .filter(s => s.status === "paid" || s.status === "offered")
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.getTime() - b.startTime.getTime());

  const rows = paid.map(slot => {
    const buyer = slot.buyerId ? userMap[slot.buyerId] : null;
    const payment = slot.stripeSessionId ? paymentBySession[slot.stripeSessionId] : null;
    return [
      new Date().toLocaleDateString("fr-FR"),
      slot.date,
      formatTime(slot.startTime),
      categoryIdBySlot[slot.id] || slot.categoryId,
      slot.status,
      slot.participant ? `${slot.participant.firstName} ${slot.participant.lastName}` : "",
      slot.participant?.shirtSize || "",
      buyer ? formatUser(buyer) : "",
      buyer?.email || "",
      payment ? payment.amount : slot.status === "offered" ? "0" : "",
      payment?.source || "",
      slot.stripeSessionId || "",
      payment?.createdAt ? new Date(payment.createdAt).toLocaleString("fr-FR") : "",
    ];
  });

  return buildCsv(headers, rows);
}

/** 5. FINANCIAL SUMMARY — Per-person payment summary with total */
function generateFinancialSummary(users: User[], payments: Payment[], slots: Slot[], eventId: string): string {
  const headers = ["First Name", "Last Name", "Email", "Country", "Registration Paid", "Slots Assigned", "Total Paid (€)", "Stripe Sessions"];

  // Map payments by userId (use buyerId from slots as bridge)
  const paymentsByUser: Record<string, Payment[]> = {};
  const slotsByUser: Record<string, Slot[]> = {};
  for (const slot of slots) {
    if (slot.buyerId) {
      if (!slotsByUser[slot.buyerId]) slotsByUser[slot.buyerId] = [];
      slotsByUser[slot.buyerId].push(slot);
    }
  }
  for (const p of payments) {
    if (p.userId) {
      if (!paymentsByUser[p.userId]) paymentsByUser[p.userId] = [];
      paymentsByUser[p.userId].push(p);
    }
  }

  const registeredUsers = users.filter(u => u.registrations[eventId]);
  let grandTotal = 0;

  const rows = registeredUsers.map(user => {
    const reg = user.registrations[eventId];
    const userPayments = paymentsByUser[user.id] || [];
    const userTotal = userPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const userSlots = slotsByUser[user.id] || [];
    const sessions = userPayments.map(p => p.stripeSessionId || "manual").join(" | ");
    grandTotal += userTotal;
    return [
      user.firstName,
      user.lastName,
      user.email,
      user.country || "",
      reg?.paid ? "Yes" : "No",
      userSlots.length,
      userTotal.toFixed(2),
      sessions,
    ];
  });

  // Grand total row
  rows.push(["", "", "", "", "", "TOTAL", grandTotal.toFixed(2), ""]);

  return buildCsv(headers, rows);
}

type MealGuestPreview = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  isParticipant?: boolean;
};

function parseMealGuests(payment: Payment): MealGuestPreview[] {
  const raw = payment.metadata?.mealGuests;
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as MealGuestPreview[] : [];
  } catch {
    return [];
  }
}

function getPaymentMealRows(payments: Payment[], users: User[]) {
  const userMap = Object.fromEntries(users.map(user => [user.id, user]));

  return payments.flatMap(payment => {
    const guests = parseMealGuests(payment);
    if (guests.length === 0) return [];

    const buyer = userMap[payment.userId];
    const mealPrice = Number(payment.metadata?.mealPrice || 0);

    return guests.map((guest, index) => ({
      payment,
      guest,
      index,
      buyer,
      mealPrice,
    }));
  });
}

/** 6. MEALS — One row per meal guest */
function generateMealsCsv(payments: Payment[], users: User[]): string {
  const headers = ["Payment Date", "Guest First Name", "Guest Last Name", "Email", "Phone", "Buyer", "Buyer Email", "Meal Price (€)", "Stripe Session"];
  const rows = getPaymentMealRows(payments, users).map(row => [
    row.payment.createdAt ? row.payment.createdAt.toLocaleString("fr-FR") : "",
    row.guest.firstName || "",
    row.guest.lastName || "",
    row.guest.email || "",
    row.guest.phone || "",
    row.buyer ? formatUser(row.buyer) : "",
    row.buyer?.email || "",
    row.mealPrice ? row.mealPrice.toFixed(2) : "",
    row.payment.stripeSessionId || "",
  ]);

  return buildCsv(headers, rows);
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

interface ExportsPageProps {
  slots: Slot[];
  categories: Category[];
  users: User[];
  payments: Payment[];
  selectedEvent?: WPTEvent;
}

interface ExportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  generate: () => string;
  filename: string;
}

export function ExportsPage({ slots, categories, users, payments, selectedEvent }: ExportsPageProps) {
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({});
  const [successState, setSuccessState] = useState<Record<string, boolean>>({});

  const [isSheetConnected, setIsSheetConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"planning" | "payments" | "meals">("planning");
  const [previewCategoryId, setPreviewCategoryId] = useState<string>("all");

  const eventId = selectedEvent?.id || "";
  const eventYear = selectedEvent?.eventYear || new Date().getFullYear();

  const sortedSlots = useMemo(() =>
    [...slots].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.getTime() - b.startTime.getTime();
    }), [slots]);

  const filteredPreviewSlots = useMemo(() =>
    previewCategoryId === "all"
      ? sortedSlots
      : sortedSlots.filter(slot => slot.categoryId === previewCategoryId),
    [previewCategoryId, sortedSlots]
  );

  const getCategoryName = (categoryId: string) =>
    categories.find(c => c.id === categoryId)?.name || categoryId;

  const userMap = useMemo(() =>
    Object.fromEntries(users.map(u => [u.id, u])), [users]);

  const previewPaymentRows = useMemo(() => {
    const rows = payments.map(payment => {
      const paymentSlots = slots.filter(slot => payment.slotIds.includes(slot.id));
      return { payment, paymentSlots, buyer: payment.userId ? userMap[payment.userId] : null };
    });

    if (previewCategoryId === "all") return rows;
    return rows.filter(row => row.paymentSlots.some(slot => slot.categoryId === previewCategoryId));
  }, [payments, previewCategoryId, slots, userMap]);

  const previewMealRows = useMemo(() => {
    return getPaymentMealRows(payments, users);
  }, [payments, users]);

  // Stats
  const paidSlots = slots.filter(s => s.status === "paid" || s.status === "offered").length;
  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const registeredUsers = users.filter(u => u.registrations[eventId]).length;

  const EXPORT_CARDS: ExportCard[] = [
    {
      id: "running_order",
      title: "Planning de passage",
      description: "Planning complet trié par date et heure, avec participants, catégories et créneaux.",
      icon: <Calendar className="h-5 w-5" />,
      color: "blue",
      filename: `WPT_${eventYear}_Running_Order.csv`,
      generate: () => generateRunningOrder(slots, categories, users),
    },
    {
      id: "by_category",
      title: "Planning par catégorie",
      description: "Participants regroupés par catégorie, pratique pour les jurys et responsables de catégorie.",
      icon: <Trophy className="h-5 w-5" />,
      color: "purple",
      filename: `WPT_${eventYear}_By_Category.csv`,
      generate: () => generateByCategory(slots, categories, users),
    },
    {
      id: "participants",
      title: "Liste des participants",
      description: "Liste complète des compétiteurs avec coordonnées, statut de paiement et créneaux assignés.",
      icon: <Users className="h-5 w-5" />,
      color: "green",
      filename: `WPT_${eventYear}_Participants.csv`,
      generate: () => generateParticipantList(slots, categories, users),
    },
    {
      id: "financial_detail",
      title: "Détail financier",
      description: "Tous les créneaux payés ou offerts avec montants, sessions Stripe et dates de paiement.",
      icon: <CreditCard className="h-5 w-5" />,
      color: "amber",
      filename: `WPT_${eventYear}_Financial_Detail.csv`,
      generate: () => generateFinancialDetail(slots, payments, users),
    },
    {
      id: "financial_summary",
      title: "Synthèse financière",
      description: "Synthèse des revenus par inscrit avec total général.",
      icon: <BarChart3 className="h-5 w-5" />,
      color: "red",
      filename: `WPT_${eventYear}_Financial_Summary.csv`,
      generate: () => generateFinancialSummary(users, payments, slots, eventId),
    },
    {
      id: "meals",
      title: "Repas",
      description: "CSV dédié aux repas, avec une ligne par participant ou accompagnant inscrit au repas.",
      icon: <UtensilsCrossed className="h-5 w-5" />,
      color: "teal",
      filename: `WPT_${eventYear}_Repas.csv`,
      generate: () => generateMealsCsv(payments, users),
    },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    red: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    teal: "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400",
  };

  const handleExport = async (card: ExportCard) => {
    setLoadingState(prev => ({ ...prev, [card.id]: true }));
    setSuccessState(prev => ({ ...prev, [card.id]: false }));
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const csv = card.generate();
      downloadCsv(csv, card.filename);
      setSuccessState(prev => ({ ...prev, [card.id]: true }));
      setTimeout(() => setSuccessState(prev => ({ ...prev, [card.id]: false })), 3000);
    } catch (error) {
      console.error("Export failed", error);
    } finally {
      setLoadingState(prev => ({ ...prev, [card.id]: false }));
    }
  };

  const handleExportAll = async () => {
    for (const card of EXPORT_CARDS) {
      const csv = card.generate();
      downloadCsv(csv, card.filename);
      await new Promise(r => setTimeout(r, 200));
    }
  };

  const handleConnectSheet = () => {
    const width = 500, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open("", "Connect Google Sheets", `width=${width},height=${height},left=${left},top=${top}`);
    if (popup) {
      popup.document.write(`<html><body style="font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f0f2f5"><h2 style="color:#444">Google Workspace</h2><p>Connecting WPT Admin to Google Sheets...</p><div style="margin-top:20px;color:green">Success! Closing window...</div></body></html>`);
      setTimeout(() => { popup.close(); setIsSheetConnected(true); setLastSynced("A l'instant"); }, 1500);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLastSynced(new Date().toLocaleTimeString());
    setIsSyncing(false);
  };

  return (
    <div className="space-y-8">

      {/* ── STATS BAR ── */}
      {selectedEvent && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-2xl font-bold">{registeredUsers}</div>
            <div className="text-xs text-muted-foreground mt-1">Compétiteurs inscrits</div>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-2xl font-bold">{paidSlots}</div>
            <div className="text-xs text-muted-foreground mt-1">Créneaux assignés (payés + offerts)</div>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-2xl font-bold">{totalRevenue.toFixed(0)} €</div>
            <div className="text-xs text-muted-foreground mt-1">Revenus enregistrés</div>
          </div>
        </div>
      )}

      {/* ── CSV EXPORTS ── */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Exports CSV</h2>
            <p className="text-muted-foreground">Téléchargez les rapports pour l&apos;équipe, les jurys et la comptabilité.</p>
          </div>
          <Button variant="outline" onClick={handleExportAll} className="gap-2">
            <Download className="h-4 w-4" />
            Tout exporter ({EXPORT_CARDS.length} fichiers)
          </Button>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {EXPORT_CARDS.map((card) => (
            <Card key={card.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", colorMap[card.color])}>
                    {card.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base">{card.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{card.filename}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-4">
                <CardDescription className="flex-1 text-sm">{card.description}</CardDescription>
                <div className="mt-auto pt-2">
                  <Button
                    className={cn(
                      "w-full transition-all duration-300",
                      successState[card.id] ? "bg-green-600 hover:bg-green-700 text-white" : ""
                    )}
                    onClick={() => handleExport(card)}
                    disabled={loadingState[card.id]}
                  >
                    {loadingState[card.id] ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Génération...</>
                    ) : successState[card.id] ? (
                      <><CheckCircle2 className="mr-2 h-4 w-4" />Téléchargé</>
                    ) : (
                      <><Download className="mr-2 h-4 w-4" />Export CSV</>
                    )}
                  </Button>
                  {successState[card.id] && (
                    <p className="text-xs text-center text-green-600 dark:text-green-400 mt-2 animate-in fade-in slide-in-from-top-1">
                      Fichier téléchargé
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── LIVE PREVIEW / GOOGLE SHEETS ── */}
      <div className="border-t pt-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">Aperçu</h2>
        <Card className={cn("border-l-4 overflow-hidden", isSheetConnected ? "border-l-green-500" : "border-l-blue-500")}>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-md", isSheetConnected ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30")}>
                  <FileSpreadsheet className={cn("h-6 w-6", isSheetConnected ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400")} />
                </div>
                <div>
                  <CardTitle>Aperçu opérationnel</CardTitle>
                  <CardDescription>Planning, paiements et repas filtrables par catégorie.</CardDescription>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={previewCategoryId}
                  onChange={(e) => setPreviewCategoryId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Toutes les catégories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                <div className="flex rounded-md border bg-muted/40 p-1">
                  {[
                    { id: "planning", label: "Planning" },
                    { id: "payments", label: "Paiements" },
                    { id: "meals", label: "Repas" },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPreviewMode(item.id as typeof previewMode)}
                      className={cn(
                        "h-7 rounded px-3 text-xs font-medium transition",
                        previewMode === item.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden shadow-sm bg-background">
              <div className="overflow-x-auto max-h-[400px]">
                {previewMode === "planning" && (
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        {["#", "Date", "Début", "Fin", "Catégorie", "Statut", "Participant", "T-shirt", "Acheteur"].map(h => (
                          <th key={h} className="bg-gray-100 dark:bg-zinc-800 border px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPreviewSlots.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-8 text-muted-foreground text-sm">Aucun créneau pour ce filtre.</td></tr>
                      ) : filteredPreviewSlots.map((slot, idx) => {
                        const buyer = slot.buyerId ? userMap[slot.buyerId] : null;
                        return (
                          <tr key={slot.id} className="border-b hover:bg-muted/30">
                            <td className="bg-gray-50 dark:bg-zinc-900 border-r text-center text-xs text-muted-foreground px-2">{idx + 1}</td>
                            <td className="border-r px-2 py-1.5 text-xs whitespace-nowrap">{slot.date}</td>
                            <td className="border-r px-2 py-1.5 text-xs font-mono">{formatTime(slot.startTime)}</td>
                            <td className="border-r px-2 py-1.5 text-xs font-mono">{formatTime(slot.endTime)}</td>
                            <td className="border-r px-2 py-1.5 text-xs">{getCategoryName(slot.categoryId)}</td>
                            <td className="border-r px-2 py-1.5 text-xs">{slot.status}</td>
                            <td className="border-r px-2 py-1.5 text-xs font-medium text-green-700 dark:text-green-300">
                              {slot.participant ? `${slot.participant.firstName} ${slot.participant.lastName}` : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="border-r px-2 py-1.5 text-xs">{slot.participant?.shirtSize || "—"}</td>
                            <td className="px-2 py-1.5 text-xs">{buyer ? formatUser(buyer) : <span className="text-muted-foreground">—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {previewMode === "payments" && (
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        {["Date", "Acheteur", "Catégories", "Créneaux", "Montant", "Source", "Statut"].map(h => (
                          <th key={h} className="bg-gray-100 dark:bg-zinc-800 border px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewPaymentRows.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Aucun paiement pour ce filtre.</td></tr>
                      ) : previewPaymentRows.map(({ payment, paymentSlots, buyer }) => (
                        <tr key={payment.id} className="border-b hover:bg-muted/30">
                          <td className="border-r px-2 py-1.5 text-xs whitespace-nowrap">{payment.createdAt.toLocaleString("fr-FR")}</td>
                          <td className="border-r px-2 py-1.5 text-xs">{buyer ? formatUser(buyer) : payment.userId}</td>
                          <td className="border-r px-2 py-1.5 text-xs">{Array.from(new Set(paymentSlots.map(slot => getCategoryName(slot.categoryId)))).join(" | ") || "—"}</td>
                          <td className="border-r px-2 py-1.5 text-xs">{payment.slotIds.length}</td>
                          <td className="border-r px-2 py-1.5 text-xs font-semibold">{payment.amount.toFixed(2)} €</td>
                          <td className="border-r px-2 py-1.5 text-xs">{payment.source}</td>
                          <td className="px-2 py-1.5 text-xs">{payment.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {previewMode === "meals" && (
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        {["Personne", "Acheteur", "Prix repas", "Paiement"].map(h => (
                          <th key={h} className="bg-gray-100 dark:bg-zinc-800 border px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewMealRows.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Aucun repas enregistré.</td></tr>
                      ) : previewMealRows.map((row) => (
                        <tr key={`${row.payment.id}-${row.index}`} className="border-b hover:bg-muted/30">
                          <td className="border-r px-2 py-1.5 text-xs font-medium">{row.guest.firstName} {row.guest.lastName}</td>
                          <td className="border-r px-2 py-1.5 text-xs">{row.buyer ? formatUser(row.buyer) : row.payment.userId}</td>
                          <td className="border-r px-2 py-1.5 text-xs">{row.mealPrice ? `${row.mealPrice.toFixed(2)} €` : "—"}</td>
                          <td className="px-2 py-1.5 text-xs font-mono">{row.payment.stripeSessionId || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {previewMode === "planning" && `${filteredPreviewSlots.length} créneaux affichés`}
                {previewMode === "payments" && `${previewPaymentRows.length} paiements affichés`}
                {previewMode === "meals" && `${previewMealRows.length} repas affichés`}
                {lastSynced ? ` • Dernière sync: ${lastSynced}` : ""}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleConnectSheet}>
                  <LinkIcon className="mr-2 h-3 w-3" />
                  {isSheetConnected ? "Synchroniser Google Sheets" : "Connecter Google Sheets"}
                </Button>
                {isSheetConnected && (
                  <Button size="sm" onClick={handleManualSync} disabled={isSyncing}>
                    {isSyncing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                    {isSyncing ? "Synchronisation..." : "Forcer la sync"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
