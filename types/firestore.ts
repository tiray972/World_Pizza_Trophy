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
  eventStartDate: Date;
  eventEndDate: Date;
  registrationDeadline: Date;
  status: EventStatus;
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
  description: string;
  rules?: string;
  unitPrice: number;
  maxSlots: number;
  durationMinutes: number;
  activeDates: string[]; // ISO date strings (YYYY-MM-DD)
  isActive: boolean;
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
  date: string; // ISO date string (YYYY-MM-DD)
  startTime: Date; // Converted from Firestore Timestamp
  endTime: Date;   // Converted from Firestore Timestamp
  status: SlotStatus;
  userId?: string;
  stripeSessionId: string | null;
  
  // Traceability Fields
  assignedByAdminId?: string;
  assignedAt?: Date; // Converted from Firestore Timestamp
  assignmentType?: AssignmentType;
}

/* ---------------------------------
   PRODUCTS / PACKS
---------------------------------- */

export interface Product {
  id: string;
  eventId: string;
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
  
  metadata: Record<string, any>;
  createdAt: Date;  // Converted from Firestore Timestamp
  updatedAt: Date;  // Converted from Firestore Timestamp
}
