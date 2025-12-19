import { LucideIcon } from "lucide-react";
import { Timestamp } from "firebase/firestore";

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
  | 'payments' // Added payments view
  | 'exports';

/* ---------------------------------
   EVENTS
---------------------------------- */

/**
 * Event Lifecycle Status:
 * - 'draft': Initial setup. Configuration mode. Public registrations hidden. Slot creation disabled.
 * - 'open': Active event. Registrations open. Slot creation and assignment allowed.
 * - 'closed': Event finished or registrations stopped. Read-only for participants. No new assignments.
 * - 'archived': Old event. Strictly read-only for history. Hidden from main lists.
 */
export type EventStatus = 'draft' | 'open' | 'closed' | 'archived';

export interface WPTEvent {
  id: string;
  name: string;
  eventYear: number;
  eventStartDate: Timestamp;
  eventEndDate: Timestamp;
  registrationDeadline: Timestamp;
  status: EventStatus; // Replaces isActive
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
  registeredAt: Timestamp;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  phone: string;
  role: UserRole; // Global role (e.g. is this person an admin?)
  createdAt: Timestamp;
  
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
  eventId: string; // Linked to specific event
  name: string;
  description: string;
  rules?: string; // HTML or Text rules/regulations
  unitPrice: number;
  maxSlots: number;
  durationMinutes: number;
  activeDates: string[];
  isActive: boolean; // Controls visibility for slot creation
}

/* ---------------------------------
   SLOTS
---------------------------------- */

export type SlotStatus = 'available' | 'locked' | 'paid' | 'offered';
export type AssignmentType = 'manual' | 'payment' | 'voucher';

export interface Slot {
  id: string;
  eventId: string;
  categoryId: string;
  date: string;
  startTime: Timestamp;
  endTime: Timestamp;
  status: SlotStatus;
  userId?: string;
  stripeSessionId: string | null;
  
  // Traceability Fields
  assignedByAdminId?: string; // If assigned manually by admin
  assignedAt?: Timestamp; // When the assignment happened
  assignmentType?: AssignmentType;
}

/* ---------------------------------
   PRODUCTS / PACKS
---------------------------------- */

export interface Product {
  id: string;
  eventId: string; // Linked to specific event
  name: string;
  description: string;
  stripePriceId: string;
  unitAmount: number;
  slotsRequired: number;
  isPack: boolean;
  includesMeal: boolean;
  isActive: boolean;
}

/* ---------------------------------
   VOUCHERS
---------------------------------- */

export interface Voucher {
  id: string;
  eventId: string; // Linked to specific event
  code: string;
  productId: string;
  isSingleUse: boolean;
  isUsed: boolean;
  userId: string | null;
  expiresAt: Timestamp | null;
  createdAt: Timestamp;
}

/* ---------------------------------
   PAYMENTS
---------------------------------- */

export type PaymentSource = 'stripe' | 'manual' | 'admin';

export interface Payment {
  id: string;
  eventId: string; // CRITICAL: Links payment to specific event year
  userId: string;
  stripeSessionId: string | null; // Null if manual/admin
  amount: number; // Amount in cents
  status: 'paid' | 'refunded' | 'failed' | 'pending';
  source: PaymentSource;
  
  slotIds: string[]; // Slots reserved by this payment
  isPack: boolean;
  packName?: string;
  
  metadata: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
