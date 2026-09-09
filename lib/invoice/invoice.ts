// lib/invoice/invoice.ts
// Construction des justificatifs de paiement (factures) téléchargeables
// depuis l'espace compte. Les données proviennent du document `payments`
// (montant réellement encaissé par Stripe) enrichi des créneaux et repas.

/**
 * Émetteur du document.
 * ⚠️ `registrationNumber`, `vatNumber` et `vatNote` sont volontairement vides :
 * à compléter par l'organisation si ses mentions légales doivent figurer sur
 * la facture. Les champs vides ne sont tout simplement pas affichés.
 */
export const INVOICE_ISSUER = {
  name: "World Pizza Trophy",
  legalName: "Trophée Mondial de la Pizza",
  address: "8 Av. Boyer, 06500 Menton, France",
  email: "contact@worldpizzatrophy.com",
  phone: "+33 6 11 85 43 43",
  website: "worldpizzatrophy.com",
  registrationNumber: "",
  vatNumber: "",
  vatNote: "",
};

export interface InvoiceLine {
  label: string;
  details?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceParticipantRow {
  categoryName: string;
  date: string;
  startTime: Date;
  endTime: Date;
  participants: string[];
}

export interface InvoicePaymentInput {
  id: string;
  amount: number;
  createdAt: Date;
  isPack?: boolean;
  packName?: string;
  slotIds: string[];
  metadata?: Record<string, string> | null;
}

export interface InvoiceSlotInput {
  id: string;
  categoryId: string;
  categoryName: string;
  date: string;
  startTime: Date;
  endTime: Date;
}

/** Numéro de facture lisible et stable : WPT-2026-AB12CD. */
export function invoiceNumber(payment: InvoicePaymentInput): string {
  const year = payment.createdAt.getFullYear();
  return `WPT-${year}-${payment.id.slice(0, 6).toUpperCase()}`;
}

/** Invités repas enregistrés dans les métadonnées du paiement. */
export function mealGuestsOfPayment(
  payment: InvoicePaymentInput
): { firstName: string; lastName: string }[] {
  const raw = payment.metadata?.mealGuests;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mealPriceOfPayment(payment: InvoicePaymentInput): number {
  return Number(payment.metadata?.mealPrice || 0);
}

/**
 * Lignes de facturation : un regroupement par catégorie (ou une ligne unique
 * pour un pack), puis les repas. Le total de référence reste le montant
 * encaissé ; tout écart apparaît explicitement en ajustement.
 */
export function buildInvoiceLines(
  payment: InvoicePaymentInput,
  slots: InvoiceSlotInput[],
  categoryPrices: Record<string, number>
): { lines: InvoiceLine[]; total: number } {
  const lines: InvoiceLine[] = [];

  const mealGuests = mealGuestsOfPayment(payment);
  const mealQuantity = Number(payment.metadata?.mealQuantity || mealGuests.length || 0);
  const mealPrice = mealPriceOfPayment(payment);
  const mealTotal = mealQuantity > 0 ? mealQuantity * mealPrice : 0;

  if (payment.isPack) {
    lines.push({
      label: `Pack ${payment.packName || ""}`.trim(),
      details: `${payment.slotIds.length} créneau(x) de compétition`,
      quantity: 1,
      unitPrice: Math.max(0, payment.amount - mealTotal),
      total: Math.max(0, payment.amount - mealTotal),
    });
  } else {
    const byCategory = new Map<string, InvoiceSlotInput[]>();
    for (const slot of slots) {
      const list = byCategory.get(slot.categoryId) ?? [];
      list.push(slot);
      byCategory.set(slot.categoryId, list);
    }

    for (const [categoryId, categorySlots] of byCategory) {
      const unitPrice = categoryPrices[categoryId] ?? 0;
      lines.push({
        label: categorySlots[0].categoryName,
        details: categorySlots
          .map(slot => `${formatInvoiceDate(slot.date)} à ${formatInvoiceTime(slot.startTime)}`)
          .join(", "),
        quantity: categorySlots.length,
        unitPrice,
        total: unitPrice * categorySlots.length,
      });
    }
  }

  if (mealQuantity > 0) {
    lines.push({
      label: "Repas",
      details: mealGuests.length
        ? mealGuests.map(guest => `${guest.firstName} ${guest.lastName}`.trim()).join(", ")
        : undefined,
      quantity: mealQuantity,
      unitPrice: mealPrice,
      total: mealTotal,
    });
  }

  const linesTotal = lines.reduce((sum, line) => sum + line.total, 0);
  const difference = Math.round((payment.amount - linesTotal) * 100) / 100;

  // Créneau supprimé, tarif modifié depuis l'achat, remise... : on ne masque
  // jamais l'écart avec le montant réellement encaissé.
  if (Math.abs(difference) >= 0.01) {
    lines.push({
      label: difference > 0 ? "Autres prestations" : "Remise",
      quantity: 1,
      unitPrice: difference,
      total: difference,
    });
  }

  return { lines, total: payment.amount };
}

export function formatInvoiceAmount(amount: number): string {
  return amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function formatInvoiceDate(date: string | Date): string {
  const value = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  return value.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatInvoiceTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
