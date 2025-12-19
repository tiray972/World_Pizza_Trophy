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
  | 'slots'
  | 'products'
  | 'vouchers'
  | 'users'
  | 'exports';

/* ---------------------------------
   USERS
---------------------------------- */

export type UserRole = 'user' | 'admin' | 'jury';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  phone: string;
  role: UserRole;
  categoryIds: string[];
  paid: boolean;
  stripeCustomerId?: string;
  createdAt: Timestamp;
}

/* ---------------------------------
   GLOBAL SETTINGS
---------------------------------- */

export interface Settings {
  id: 'config';
  eventStartDate: Timestamp;
  eventEndDate: Timestamp;
  registrationDeadline: Timestamp;
  eventYear: number;
}

/* ---------------------------------
   CATEGORIES
---------------------------------- */

export interface Category {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  maxSlots: number;
  durationMinutes: number;

  /**
   * Dates ISO (YYYY-MM-DD) où la catégorie est active
   * Permet N jours d'événement sans refactor
   */
  activeDates: string[];
}

/* ---------------------------------
   SLOTS
---------------------------------- */

export type SlotStatus = 'available' | 'locked' | 'paid' | 'offered';

export interface Slot {
  id: string;

  /** Relation Firestore */
  categoryId: string;

  /** Date réelle du slot (ISO YYYY-MM-DD) */
  date: string;

  /** Heures réelles stockées en Timestamp */
  startTime: Timestamp;
  endTime: Timestamp;

  status: SlotStatus;

  /** Booking */
  userId?: string;
  stripeSessionId: string | null;
}

/* ---------------------------------
   PRODUCTS / PACKS
---------------------------------- */

export interface Product {
  id: string;
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

export interface Payment {
  id: string;
  userId: string;
  stripeSessionId: string;
  amount: number; // EUR
  status: 'paid' | 'refunded' | 'failed';
  slotIds: string[];
  isPack: boolean;
  packName?: string;
  metadata: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
