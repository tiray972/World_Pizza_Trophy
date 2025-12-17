import { LucideIcon } from "lucide-react";

export interface NavItem {
  title: string;
  href: string; // Used as an ID for this simple React implementation
  icon: LucideIcon;
  label?: string;
}

export type ViewType = 'dashboard' | 'slots' | 'products' | 'vouchers' | 'users' | 'exports';

export type SlotStatus = 'available' | 'paid' | 'offered';

export interface User {
  id: string;
  fullName: string;
  email: string;
  paid: boolean;
}

export interface Slot {
  id: string;
  category: string;
  date: string; // ISO Date string YYYY-MM-DD
  startTime: string;
  endTime: string;
  status: SlotStatus;
  userId?: string;
  userFullName?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  slotsRequired: number;
  isActive: boolean;
}

export interface Voucher {
  id: string;
  code: string;
  productName: string;
  isSingleUse: boolean;
  isUsed: boolean;
  expiresAt?: string;
}