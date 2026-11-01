// lib/domain/event-lifecycle.ts
// Cycle de vie d'une édition. Le statut opérationnel est distinct de la
// publication des résultats (gérée catégorie par catégorie).
//
//   draft ──► open ──► closed ──► completed ──► archived
//
// Archiver n'est pas supprimer : historique, exports, comptes et factures restent
// accessibles ; les paiements tardifs, remboursements et rapprochements restent
// traités. Seules les nouvelles ventes sont fermées.

import type { EventStatus } from "@/types/firestore";

export const EVENT_STATUS_ORDER: EventStatus[] = ["draft", "open", "closed", "completed", "archived"];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Brouillon",
  open: "Inscriptions ouvertes",
  closed: "Inscriptions closes",
  completed: "Terminé",
  archived: "Archivé",
};

/** Nouvelles réservations publiques et nouveaux paiements d'inscription. */
export function acceptsNewBookings(
  event: { status?: string; registrationDeadline?: Date | null } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!event || event.status !== "open") return false;
  const deadline = event.registrationDeadline;
  return !(deadline instanceof Date && !Number.isNaN(deadline.getTime()) && now.getTime() > deadline.getTime());
}

export type BookingRefusal = "event_missing" | "event_not_open" | "registration_deadline_passed";

export function bookingRefusalReason(
  event: { status?: string; registrationDeadline?: Date | null } | null | undefined,
  now: Date = new Date()
): BookingRefusal | null {
  if (!event) return "event_missing";
  if (event.status !== "open") return "event_not_open";
  if (!acceptsNewBookings(event, now)) return "registration_deadline_passed";
  return null;
}

/** Une session Stripe déjà payée est toujours finalisée, quel que soit le statut. */
export function acceptsLatePaymentFinalization(): boolean {
  return true;
}

/** Saisie et publication des résultats. */
export function acceptsResults(status: string | undefined): boolean {
  return status === "closed" || status === "completed" || status === "archived";
}

/** Transitions autorisées depuis le dashboard (retour arrière explicite possible sauf vers brouillon). */
export function allowedTransitions(status: EventStatus): EventStatus[] {
  switch (status) {
    case "draft":
      return ["open"];
    case "open":
      return ["closed"];
    case "closed":
      return ["open", "completed"];
    case "completed":
      return ["closed", "archived"];
    case "archived":
      return ["completed"];
    default:
      return [];
  }
}

export function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
