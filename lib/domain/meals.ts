// lib/domain/meals.ts
// Repas : commandes groupées par acheteur et feuille de pointage (une ligne
// par place). Fonctions pures, partagées par le dashboard, les exports et les
// tests.
//
// Règles :
//  - une place payée = une ligne, nommée ou « à compléter » ;
//  - jamais de dédoublonnage sur un nom (trois places FAGNANI restent trois places) ;
//  - deux enregistrements d'une même session Stripe sont UN seul paiement :
//    la session ne peut être payée qu'une fois (cas MALTESE 2026) ;
//  - une place remboursée ou annulée n'apparaît pas sur la feuille de pointage.

import { displayName } from "./names";
import { UNNAMED_PACK_MEAL } from "@/lib/booking/packs";

export interface SeatView {
  id: string;
  paymentId: string;
  stripeSessionId: string | null;
  buyerId: string;
  seatIndex: number;
  seatsInOrder: number;
  beneficiary: { firstName: string; lastName: string } | null;
  unitPrice: number | null;
  includedInPack: boolean;
  financialStatus: "paid" | "refunded" | "cancelled";
  present: boolean;
  /** Place reconstituée d'un paiement historique (pas encore de document `mealSeats`). */
  derived: boolean;
}

export interface PaymentView {
  id: string;
  userId: string;
  stripeSessionId: string | null;
  status: string;
  amount: number;
  createdAt: Date | null;
  isPack: boolean;
  packName?: string | null;
  metadata?: Record<string, unknown>;
  mealSeatIds?: string[];
  stripeInvoiceNumber?: string | null;
}

export interface MealAnomaly {
  kind: "duplicate_payment_record" | "missing_names" | "refunded";
  paymentId: string;
  stripeSessionId: string | null;
  message: string;
}

function parseGuests(raw: unknown): { firstName?: string; lastName?: string }[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isPlaceholder(guest: { firstName?: string; lastName?: string }): boolean {
  return (
    !guest.firstName?.trim() ||
    !guest.lastName?.trim() ||
    (guest.firstName === UNNAMED_PACK_MEAL.firstName && guest.lastName === UNNAMED_PACK_MEAL.lastName)
  );
}

const financialOf = (status: string): SeatView["financialStatus"] =>
  status === "refunded" ? "refunded" : status === "failed" || status === "pending" ? "cancelled" : "paid";

/**
 * Un seul enregistrement retenu par session Stripe (le plus ancien) ; les
 * autres sont signalés comme doublons d'enregistrement, sans être effacés.
 */
export function canonicalPayments(payments: PaymentView[]): { kept: PaymentView[]; duplicates: PaymentView[] } {
  const bySession = new Map<string, PaymentView[]>();
  const kept: PaymentView[] = [];
  for (const payment of payments) {
    if (!payment.stripeSessionId) {
      kept.push(payment);
      continue;
    }
    bySession.set(payment.stripeSessionId, [...(bySession.get(payment.stripeSessionId) ?? []), payment]);
  }
  const duplicates: PaymentView[] = [];
  for (const group of bySession.values()) {
    const sorted = [...group].sort(
      (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) || a.id.localeCompare(b.id)
    );
    // Préférer l'enregistrement qui porte déjà ses places (nouveau format).
    const withSeats = sorted.find(payment => (payment.mealSeatIds?.length ?? 0) > 0);
    const canonical = withSeats ?? sorted[0];
    kept.push(canonical);
    duplicates.push(...sorted.filter(payment => payment !== canonical));
  }
  return { kept, duplicates };
}

/** Places d'un paiement historique, reconstituées depuis ses metadata (lecture seule). */
export function derivedSeats(payment: PaymentView): SeatView[] {
  const metadata = payment.metadata ?? {};
  const guests = parseGuests(metadata.mealGuests);
  const declared = Number(metadata.mealQuantity ?? 0);
  const quantity = Math.max(guests.length, Number.isFinite(declared) ? declared : 0);
  const mealPrice = Number(metadata.mealPrice ?? 0);
  return Array.from({ length: quantity }, (_, seatIndex) => {
    const guest = guests[seatIndex];
    return {
      id: `${payment.id}_legacy_${seatIndex + 1}`,
      paymentId: payment.id,
      stripeSessionId: payment.stripeSessionId,
      buyerId: payment.userId,
      seatIndex,
      seatsInOrder: quantity,
      beneficiary: guest && !isPlaceholder(guest) ? { firstName: guest.firstName!.trim(), lastName: guest.lastName!.trim() } : null,
      unitPrice: payment.isPack ? null : mealPrice || null,
      includedInPack: payment.isPack,
      financialStatus: financialOf(payment.status),
      present: false,
      derived: true,
    };
  });
}

export interface MealOrder {
  paymentId: string;
  stripeSessionId: string | null;
  buyerId: string;
  buyerLabel: string;
  createdAt: Date | null;
  paymentStatus: string;
  invoiceNumber: string | null;
  isPack: boolean;
  packName: string | null;
  seats: SeatView[];
  quantity: number;
  toComplete: number;
}

/**
 * Commandes de repas d'une édition : places réelles (`mealSeats`) quand elles
 * existent, sinon places reconstituées depuis le paiement.
 */
export function buildMealOrders(
  payments: PaymentView[],
  seats: SeatView[],
  buyerLabel: (buyerId: string) => string
): { orders: MealOrder[]; anomalies: MealAnomaly[] } {
  const { kept, duplicates } = canonicalPayments(payments);
  const seatsByPayment = new Map<string, SeatView[]>();
  seats.forEach(seat => seatsByPayment.set(seat.paymentId, [...(seatsByPayment.get(seat.paymentId) ?? []), seat]));

  const anomalies: MealAnomaly[] = duplicates
    .filter(duplicate => derivedSeats(duplicate).length > 0)
    .map(duplicate => ({
      kind: "duplicate_payment_record" as const,
      paymentId: duplicate.id,
      stripeSessionId: duplicate.stripeSessionId,
      message: `Session Stripe enregistrée plusieurs fois : ses repas ne sont comptés qu'une fois (enregistrement ${duplicate.id} ignoré, non supprimé).`,
    }));

  const orders: MealOrder[] = [];
  for (const payment of kept) {
    const orderSeats = (seatsByPayment.get(payment.id) ?? derivedSeats(payment)).sort((a, b) => a.seatIndex - b.seatIndex);
    if (orderSeats.length === 0) continue;
    const toComplete = orderSeats.filter(seat => !seat.beneficiary && seat.financialStatus === "paid").length;
    if (toComplete > 0) {
      anomalies.push({
        kind: "missing_names",
        paymentId: payment.id,
        stripeSessionId: payment.stripeSessionId,
        message: `${toComplete} place(s) payée(s) sans nom de bénéficiaire.`,
      });
    }
    if (payment.status === "refunded") {
      anomalies.push({ kind: "refunded", paymentId: payment.id, stripeSessionId: payment.stripeSessionId, message: "Commande remboursée : places exclues du pointage." });
    }
    orders.push({
      paymentId: payment.id,
      stripeSessionId: payment.stripeSessionId,
      buyerId: payment.userId,
      buyerLabel: buyerLabel(payment.userId),
      createdAt: payment.createdAt,
      paymentStatus: payment.status,
      invoiceNumber: payment.stripeInvoiceNumber ?? null,
      isPack: payment.isPack,
      packName: payment.packName ?? null,
      seats: orderSeats,
      quantity: orderSeats.length,
      toComplete,
    });
  }
  orders.sort((a, b) => a.buyerLabel.localeCompare(b.buyerLabel, "fr") || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  return { orders, anomalies };
}

export interface AttendanceRow {
  seatId: string;
  label: string;
  named: boolean;
  buyerLabel: string;
  orderRef: string;
  seatNumber: string;
  present: boolean;
  derived: boolean;
}

/** Feuille de pointage : une ligne par place payée, nommées d'abord (NOM Prénom). */
export function attendanceSheet(orders: MealOrder[]): AttendanceRow[] {
  const rows = orders.flatMap(order =>
    order.seats
      .filter(seat => seat.financialStatus === "paid")
      .map(seat => ({
        seatId: seat.id,
        label: seat.beneficiary ? displayName(seat.beneficiary) : "Place à compléter",
        named: !!seat.beneficiary,
        buyerLabel: order.buyerLabel,
        orderRef: order.stripeSessionId ?? order.paymentId,
        seatNumber: `${seat.seatIndex + 1}/${seat.seatsInOrder}`,
        present: seat.present,
        derived: seat.derived,
      }))
  );
  return rows.sort((a, b) => Number(b.named) - Number(a.named) || a.label.localeCompare(b.label, "fr") || a.buyerLabel.localeCompare(b.buyerLabel, "fr"));
}

export function mealTotals(orders: MealOrder[]) {
  const paidSeats = orders.flatMap(order => order.seats).filter(seat => seat.financialStatus === "paid");
  return {
    orders: orders.filter(order => order.seats.some(seat => seat.financialStatus === "paid")).length,
    buyers: new Set(orders.filter(order => order.seats.some(seat => seat.financialStatus === "paid")).map(order => order.buyerId)).size,
    paidSeats: paidSeats.length,
    namedSeats: paidSeats.filter(seat => seat.beneficiary).length,
    toComplete: paidSeats.filter(seat => !seat.beneficiary).length,
  };
}
