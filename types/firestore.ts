// types/firestore.ts
// ⚠️ IMPORTANT: This file defines DOMAIN TYPES (what the UI layer uses).
// All timestamp fields are plain JavaScript Date, never Firestore Timestamp.
// Conversion from Firestore Timestamp to Date happens in useFirebase.ts (client) 
// and admin API handlers (server).

import { LucideIcon } from "lucide-react";

/* ---------------------------------
   NAV / ADMIN UI
---------------------------------- */

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  label?: string;
}

export type ViewType =
  | 'dashboard'
  | 'settings'
  | 'categories'
  | 'slots'
  | 'products'
  | 'vouchers'
  | 'users'
  | 'payments'
  | 'exports'
  | 'analytics';

/* ---------------------------------
   EVENTS
---------------------------------- */

/**
 * Event Lifecycle Status:
 * - 'draft': Initial setup. Configuration mode. Public registrations hidden. Slot creation disabled.
 * - 'open': Active event. Registrations open. Slot creation and assignment allowed.
 * - 'closed': Registrations stopped. Read-only for participants. No new assignments.
 * - 'completed': Competition over ("Terminé"). Results can be entered and published.
 * - 'archived': Old event. Read-only for history, hidden from booking. Late payments,
 *   refunds and invoices keep working (see lib/domain/event-lifecycle.ts).
 */
export type EventStatus = 'draft' | 'open' | 'closed' | 'completed' | 'archived';

export interface WPTEvent {
  id: string;
  name: string;
  eventYear: number;
  eventStartDate: Date;
  eventEndDate: Date;
  registrationDeadline: Date;
  status: EventStatus;
  mealPrice?: number; // 🍽️ Prix optionnel du repas par personne
  /**
   * 🎟️ Nombre minimum de créneaux qu'un concurrent doit réserver pour payer.
   * Défaut: 2 (voir MIN_SLOTS_PER_BOOKING_DEFAULT). Les packs ne sont pas concernés.
   */
  minSlotsPerBooking?: number;
  /**
   * 📜 Le règlement de chaque catégorie doit être accepté (version publiée)
   * avant ses créneaux, et il est vérifié au paiement. Activé par édition :
   * jamais appliqué rétroactivement.
   */
  rulesAcceptanceRequired?: boolean;
}

/* ---------------------------------
   USERS
---------------------------------- */

export type UserRole = 'user' | 'admin' | 'jury';

export interface EventRegistration {
  paid: boolean;
  categoryIds: string[];
  stripeCustomerId?: string;
  paymentId?: string; // Link to the proof of payment
  registeredAt: Date;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  phone: string;
  role: UserRole;
  createdAt: Date;
  
  /**
   * Status per event.
   * Key = eventId
   */
  registrations: Record<string, EventRegistration>;
}

/* ---------------------------------
   CATEGORIES
---------------------------------- */

export interface Category {
  id: string;
  eventId: string;
  name: string;
  /** Nom traduit (repli : `name`). Les noms propres ne sont pas traduits. */
  nameI18n?: Partial<Record<'fr' | 'en' | 'es' | 'it', string>>;
  description: string;
  /** Ancien texte libre, monolingue, jamais affiché dans le Booking. */
  rules?: string;
  /** 📜 Règlement versionné en 4 langues (voir lib/domain/category-rules.ts). */
  rulesI18n?: {
    draft?: { texts: Partial<Record<'fr' | 'en' | 'es' | 'it', string>>; updatedAt?: Date; updatedBy?: string };
    published?: {
      version: number;
      versionId: string;
      texts: Partial<Record<'fr' | 'en' | 'es' | 'it', string>>;
      referenceLang: 'fr' | 'en' | 'es' | 'it';
      publishedAt: Date;
      publishedBy: string;
      publishedByName?: string;
    } | null;
  };
  unitPrice: number;
  maxSlots: number;
  durationMinutes: number;
  activeDates: string[]; // ISO date strings (YYYY-MM-DD)
  isActive: boolean;
  /**
   * 👥 Nombre de participants sur un même créneau.
   * 1 par défaut ; 2 pour les catégories en duo (ex: pizza en duo).
   */
  participantsPerSlot?: number;
}

/* ---------------------------------
   SLOTS
---------------------------------- */

export type SlotStatus = 'available' | 'locked' | 'paid' | 'offered';
export type AssignmentType = 'manual' | 'payment' | 'voucher';

export interface Participant {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  shirtSize?: TShirtSize;
}

export type TShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';

export interface MealGuest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isParticipant?: boolean;
}

export interface Slot {
  id: string;
  eventId: string;
  categoryId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  startTime: Date;
  endTime: Date;
  status: SlotStatus;
  
  // 👤 Qui a réservé ce slot
  buyerId: string; // L'utilisateur qui a payé
  
  // 👥 Qui va utiliser ce slot
  participant?: Participant; // Le 1er participant (peut être différent du buyerId)
  /**
   * Liste complète des participants du créneau (duo = 2).
   * `participant` reste renseigné avec le premier pour la rétrocompatibilité.
   */
  participants?: Participant[];
  /** 🆔 Identités stables (collection `participants`), dans l'ordre de `participants`. */
  participantIds?: string[];
  /** 👥 Équipe du créneau (catégories à plusieurs). */
  teamId?: string | null;
  
  // 🔒 Lock temporaire (10 minutes)
  lockedUntil?: Date; // Si le slot est verrouillé, jusqu'à quand?
  lockedByUserId?: string; // Qui l'a verrouillé?
  
  // 💳 Paiement
  stripeSessionId?: string | null;
  
  // Traceability
  assignedByAdminId?: string;
  assignedAt?: Date;
  assignmentType?: AssignmentType;
  paidAt?: Date; // Quand a-t-il été payé?
}

/* ---------------------------------
   PRODUCTS / PACKS
---------------------------------- */

export interface Product {
  id: string;
  eventId: string;
  name: string;
  description: string;
  /** Ancien champ : le paiement calcule le prix lui-même (non utilisé). */
  stripePriceId: string;
  unitAmount: number;
  slotsRequired: number;
  /** Ancien champ : tout produit est un pack, il n'est plus requis pour l'affichage. */
  isPack: boolean;
  /** Ancien champ booléen, remplacé par `mealsIncluded`. */
  includesMeal: boolean;
  isActive: boolean;
  /** 🍽️ Nombre de repas inclus dans UN pack (0 = aucun). */
  mealsIncluded?: number;
  /** 🚫 Catégories qui ne peuvent pas être choisies dans ce pack. */
  excludedCategoryIds?: string[];
}

/* ---------------------------------
   VOUCHERS
---------------------------------- */

export interface Voucher {
  id: string;
  eventId: string;
  code: string;
  productId: string;
  isSingleUse: boolean;
  isUsed: boolean;
  userId: string | null;
  expiresAt: Date | null; // Converted from Firestore Timestamp
  createdAt: Date;        // Converted from Firestore Timestamp
}

/* ---------------------------------
   PAYMENTS
---------------------------------- */

export type PaymentSource = 'stripe' | 'manual' | 'admin';

export interface Payment {
  id: string;
  eventId: string;
  userId: string;
  stripeSessionId: string | null;
  amount: number;
  status: 'paid' | 'refunded' | 'failed' | 'pending';
  source: PaymentSource;
  
  slotIds: string[];
  isPack: boolean;
  packName?: string;
  packId?: string;
  
  metadata: Record<string, any>;
  createdAt: Date;  // Converted from Firestore Timestamp
  updatedAt: Date;  // Converted from Firestore Timestamp

  /** Montant remboursé (€), renseigné par le webhook Stripe. */
  amountRefunded?: number;
  /** Places repas créées pour ce paiement (collection `mealSeats`). */
  mealSeatIds?: string[];
  participantIds?: string[];
  teamIds?: string[];
  /** Créneaux payés qui n'ont pas pu être attribués (pris entre-temps…). */
  slotConflicts?: SlotConflict[];
  needsReview?: boolean;
  finalizedVia?: 'webhook' | 'success_page' | 'recovery' | 'admin';
}

/* ---------------------------------
   PARTICIPANTS (identité sportive par édition)
---------------------------------- */

/**
 * Personne qui concourt, distincte du compte acheteur : un acheteur peut
 * inscrire d'autres personnes. L'identifiant est stable ; le nom peut être
 * corrigé par un administrateur (historique dans `auditLogs`).
 * Le dossard est un attribut, jamais une clé.
 */
export interface ParticipantRecord {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  /** Saisie d'origine, conservée telle quelle pour la traçabilité. */
  enteredAs?: { firstName: string; lastName: string };
  /** Clé stricte (casse et espaces ignorés, accents conservés) : recherche uniquement. */
  nameKey: string;
  email?: string;
  phone?: string;
  shirtSize?: TShirtSize;
  /** Dossard individuel, unique dans l'édition (individuels et équipes confondus). */
  bib?: number | null;
  /** Comptes ayant payé pour ce participant. */
  buyerIds: string[];
  createdFrom: 'checkout' | 'admin' | 'migration' | 'results_import';
  sourcePaymentId?: string | null;
  /** Participant retiré du planning : conservé pour l'historique, exclu des listes. */
  withdrawn?: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
}

export type TeamStatus = 'complete' | 'incomplete';

/** Équipe d'une catégorie à plusieurs (Pizza Due / Chef'Ziolo) : un seul passage, un seul résultat. */
export interface TeamRecord {
  id: string;
  eventId: string;
  categoryId: string;
  slotId: string | null;
  memberIds: string[];
  requiredMembers: number;
  status: TeamStatus;
  /** Dossard de l'équipe, distinct des dossards individuels de ses membres. */
  bib?: number | null;
  /** Nom publié quand les prénoms ne sont pas tous connus (« FARINA / POULARD »). */
  displayName?: string | null;
  buyerId?: string | null;
  createdFrom: 'checkout' | 'admin' | 'migration';
  sourcePaymentId?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/* ---------------------------------
   REPAS (une place par repas payé)
---------------------------------- */

export type MealSeatFinancialStatus = 'paid' | 'refunded' | 'cancelled';

export interface MealSeat {
  id: string;
  eventId: string;
  paymentId: string;
  stripeSessionId: string | null;
  buyerId: string;
  /** Rang de la place dans la commande (0, 1, 2…) et nombre de places de la commande. */
  seatIndex: number;
  seatsInOrder: number;
  /** Bénéficiaire connu, ou null : place payée, nom à compléter. */
  beneficiary: { firstName: string; lastName: string } | null;
  beneficiaryParticipantId?: string | null;
  /** Le site n'a vendu qu'un repas générique : aucun jour ni service n'est connu. */
  mealLabel?: string | null;
  unitPrice: number | null;
  includedInPack: boolean;
  source: 'checkout' | 'pack' | 'admin' | 'migration';
  financialStatus: MealSeatFinancialStatus;
  attendance?: { present: boolean; markedAt?: Date; markedBy?: string };
  createdAt: Date;
  updatedAt: Date;
}

/* ---------------------------------
   TRAÇABILITÉ
---------------------------------- */

export interface AuditLogEntry {
  id: string;
  eventId?: string;
  entity: 'participant' | 'team' | 'mealSeat' | 'payment' | 'slot' | 'category' | 'event' | 'result';
  entityId: string;
  action: string;
  actorUid: string;
  actorName?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  at: Date;
}

export interface SlotConflict {
  slotId: string;
  reason: 'missing' | 'taken_by_other' | 'offered' | 'other_event';
  currentStatus?: string;
  currentSessionId?: string | null;
  currentBuyerId?: string | null;
}

/** Paiement qui n'a pas pu être finalisé normalement : à traiter dans le dashboard. */
export interface PaymentIncident {
  id: string;
  stripeSessionId: string;
  eventId?: string;
  userId?: string;
  reason: 'payload_missing' | 'slot_conflict' | 'finalize_error' | 'refund_unmatched';
  details?: Record<string, unknown>;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/* ---------------------------------
   ANALYTICS / TRACKING
---------------------------------- */

export type TrackingEventType =
  | 'page_view'
  | 'click'
  | 'form_submit'
  | 'registration_start'
  | 'registration_complete'
  | 'payment_start'
  | 'payment_complete'
  | 'slot_select'
  | 'slot_book'
  | 'login'
  | 'logout'
  | 'scroll'
  | 'error';

export interface TrackingEvent {
  id: string;
  eventType: TrackingEventType;
  timestamp: Date;
  userId?: string | null;
  sessionId: string;
  path: string;
  metadata?: Record<string, any>;
}

export interface PageView {
  id: string;
  path: string;
  title?: string;
  referrer?: string;
  userAgent?: string;
  userId?: string | null;
  sessionId: string;
  timestamp: Date;
  // Performance metrics
  loadTime?: number;
  domContentLoaded?: number;
}

export interface AnalyticsSummary {
  totalPageViews: number;
  uniqueVisitors: number;
  totalEvents: number;
  topPages: { path: string; views: number }[];
  topEvents: { type: string; count: number }[];
  viewsByDate: { date: string; views: number }[];
  devices: { device: string; count: number }[];
  browsers: { browser: string; count: number }[];
  countries: { country: string; count: number }[];
}
