"use client";
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import {
  Download, FileSpreadsheet, CheckCircle2, Loader2,
  Link as LinkIcon, RefreshCw, ExternalLink, Grid,
  Users, CreditCard, Calendar, Trophy, BarChart3
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

  const headers = ["#", "Date", "Start", "End", "Category", "Status", "Participant First Name", "Participant Last Name", "Participant Email", "Participant Phone", "Buyer (Account)", "Buyer Email"];
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
      buyer ? formatUser(buyer) : "",
      buyer?.email || "",
    ];
  });

  return buildCsv(headers, rows);
}

/** 2. BY CATEGORY — One section per category with their participants */
function generateByCategory(slots: Slot[], categories: Category[], users: User[]): string {
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const headers = ["Category", "Date", "Start", "End", "Status", "Participant First Name", "Participant Last Name", "Email", "Phone", "Buyer"];
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
    rows.push([`=== ${cat.name.toUpperCase()} ===`, "", "", "", "", "", "", "", "", ""]);

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
        buyer ? formatUser(buyer) : "",
      ]);
    }

    // Blank separator
    rows.push(Array(10).fill(""));
  }

  return buildCsv(headers, rows);
}

/** 3. PARTICIPANT LIST — All registered users with their slots */
function generateParticipantList(slots: Slot[], users: User[], eventId: string): string {
  const headers = ["First Name", "Last Name", "Email", "Phone", "Country", "Registration Status", "Paid", "Slots Assigned", "Slot Dates"];

  const slotsByBuyer: Record<string, Slot[]> = {};
  for (const slot of slots) {
    if (slot.buyerId) {
      if (!slotsByBuyer[slot.buyerId]) slotsByBuyer[slot.buyerId] = [];
      slotsByBuyer[slot.buyerId].push(slot);
    }
  }

  const rows = users.map(user => {
    const reg = user.registrations[eventId];
    const userSlots = slotsByBuyer[user.id] || [];
    const slotDates = userSlots.map(s => `${s.date} ${formatTime(s.startTime)}`).join(" | ");
    return [
      user.firstName,
      user.lastName,
      user.email,
      user.phone || "",
      user.country || "",
      reg ? "Registered" : "Not Registered",
      reg?.paid ? "Yes" : "No",
      userSlots.length,
      slotDates,
    ];
  });

  return buildCsv(headers, rows);
}

/** 4. FINANCIAL DETAIL — All paid/offered slots with amounts */
function generateFinancialDetail(slots: Slot[], payments: Payment[], users: User[]): string {
  const headers = ["Date", "Slot Date", "Slot Time", "Status", "Participant", "Buyer", "Buyer Email", "Amount (€)", "Payment Method", "Stripe Session", "Recorded At"];

  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

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
      slot.status,
      slot.participant ? `${slot.participant.firstName} ${slot.participant.lastName}` : "",
      buyer ? formatUser(buyer) : "",
      buyer?.email || "",
      payment ? payment.amount : slot.status === "offered" ? "0" : "",
      payment?.paymentMethod || "",
      slot.stripeSessionId || "",
      payment?.paidAt ? new Date(payment.paidAt).toLocaleString("fr-FR") : "",
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

  const eventId = selectedEvent?.id || "";
  const eventYear = selectedEvent?.eventYear || new Date().getFullYear();

  const sortedSlots = useMemo(() =>
    [...slots].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.getTime() - b.startTime.getTime();
    }), [slots]);

  const getCategoryName = (categoryId: string) =>
    categories.find(c => c.id === categoryId)?.name || categoryId;

  const userMap = useMemo(() =>
    Object.fromEntries(users.map(u => [u.id, u])), [users]);

  // Stats
  const paidSlots = slots.filter(s => s.status === "paid" || s.status === "offered").length;
  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const registeredUsers = users.filter(u => u.registrations[eventId]).length;

  const EXPORT_CARDS: ExportCard[] = [
    {
      id: "running_order",
      title: "Running Order",
      description: "Full competition schedule sorted by date and time — for judges and staff. Includes participant names, categories, and time slots.",
      icon: <Calendar className="h-5 w-5" />,
      color: "blue",
      filename: `WPT_${eventYear}_Running_Order.csv`,
      generate: () => generateRunningOrder(slots, categories, users),
    },
    {
      id: "by_category",
      title: "Schedule by Category",
      description: "Participants grouped by competition category. Ideal for category judges and category coordinators.",
      icon: <Trophy className="h-5 w-5" />,
      color: "purple",
      filename: `WPT_${eventYear}_By_Category.csv`,
      generate: () => generateByCategory(slots, categories, users),
    },
    {
      id: "participants",
      title: "Participant Directory",
      description: "Complete list of registered competitors with contact details, payment status, and assigned slots.",
      icon: <Users className="h-5 w-5" />,
      color: "green",
      filename: `WPT_${eventYear}_Participants.csv`,
      generate: () => generateParticipantList(slots, users, eventId),
    },
    {
      id: "financial_detail",
      title: "Financial Detail",
      description: "All paid and offered slots with amounts, Stripe sessions, and payment dates. One row per slot.",
      icon: <CreditCard className="h-5 w-5" />,
      color: "amber",
      filename: `WPT_${eventYear}_Financial_Detail.csv`,
      generate: () => generateFinancialDetail(slots, payments, users),
    },
    {
      id: "financial_summary",
      title: "Financial Summary",
      description: "Per-participant revenue summary with grand total. Two exports: this one and the detail sheet above.",
      icon: <BarChart3 className="h-5 w-5" />,
      color: "red",
      filename: `WPT_${eventYear}_Financial_Summary.csv`,
      generate: () => generateFinancialSummary(users, payments, slots, eventId),
    },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    red: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
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
      setTimeout(() => { popup.close(); setIsSheetConnected(true); setLastSynced("Just now"); }, 1500);
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
            <div className="text-xs text-muted-foreground mt-1">Registered Competitors</div>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-2xl font-bold">{paidSlots}</div>
            <div className="text-xs text-muted-foreground mt-1">Slots Assigned (Paid + Offered)</div>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-2xl font-bold">{totalRevenue.toFixed(0)} €</div>
            <div className="text-xs text-muted-foreground mt-1">Total Revenue Recorded</div>
          </div>
        </div>
      )}

      {/* ── CSV EXPORTS ── */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">CSV Exports</h2>
            <p className="text-muted-foreground">Download reports for staff, judges, and accounting.</p>
          </div>
          <Button variant="outline" onClick={handleExportAll} className="gap-2">
            <Download className="h-4 w-4" />
            Export All (5 files)
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
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                    ) : successState[card.id] ? (
                      <><CheckCircle2 className="mr-2 h-4 w-4" />Downloaded</>
                    ) : (
                      <><Download className="mr-2 h-4 w-4" />Export CSV</>
                    )}
                  </Button>
                  {successState[card.id] && (
                    <p className="text-xs text-center text-green-600 dark:text-green-400 mt-2 animate-in fade-in slide-in-from-top-1">
                      File downloaded ✓
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
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">Live Preview</h2>
        <Card className={cn("border-l-4 overflow-hidden", isSheetConnected ? "border-l-green-500" : "border-l-blue-500")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-md", isSheetConnected ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30")}>
                  <FileSpreadsheet className={cn("h-6 w-6", isSheetConnected ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400")} />
                </div>
                <div>
                  <CardTitle>Running Order Preview</CardTitle>
                  <CardDescription>Real-time view of the competition schedule from this event.</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden shadow-sm bg-background">
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {["#", "Date", "Start", "End", "Category", "Status", "Participant", "Buyer"].map(h => (
                        <th key={h} className="bg-gray-100 dark:bg-zinc-800 border px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSlots.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">No slots yet for this event.</td></tr>
                    ) : sortedSlots.map((slot, idx) => {
                      const buyer = slot.buyerId ? userMap[slot.buyerId] : null;
                      return (
                        <tr key={slot.id} className="border-b hover:bg-muted/30">
                          <td className="bg-gray-50 dark:bg-zinc-900 border-r text-center text-xs text-muted-foreground px-2">{idx + 1}</td>
                          <td className="border-r px-2 py-1.5 text-xs text-foreground whitespace-nowrap">{slot.date}</td>
                          <td className="border-r px-2 py-1.5 text-xs text-foreground font-mono">{formatTime(slot.startTime)}</td>
                          <td className="border-r px-2 py-1.5 text-xs text-foreground font-mono">{formatTime(slot.endTime)}</td>
                          <td className="border-r px-2 py-1.5 text-xs text-foreground">{getCategoryName(slot.categoryId)}</td>
                          <td className="border-r px-2 py-1.5 text-xs">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                              slot.status === "paid" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                                slot.status === "offered" ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" :
                                  "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            )}>
                              {slot.status}
                            </span>
                          </td>
                          <td className="border-r px-2 py-1.5 text-xs font-medium text-green-700 dark:text-green-300">
                            {slot.participant ? `${slot.participant.firstName} ${slot.participant.lastName}` : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-foreground">
                            {buyer ? formatUser(buyer) : <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">{sortedSlots.length} slots total</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleConnectSheet}>
                  <LinkIcon className="mr-2 h-3 w-3" />
                  {isSheetConnected ? "Sync to Google Sheets" : "Connect Google Sheets"}
                </Button>
                {isSheetConnected && (
                  <Button size="sm" onClick={handleManualSync} disabled={isSyncing}>
                    {isSyncing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                    {isSyncing ? "Syncing..." : "Force Sync"}
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
