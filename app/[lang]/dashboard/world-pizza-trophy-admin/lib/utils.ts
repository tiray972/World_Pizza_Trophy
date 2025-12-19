import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { User } from "@/types/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a Date object as time string (HH:mm).
 * Accepts only Date, never Firestore Timestamp.
 */
export function formatTime(date: Date | null | undefined): string {
  if (!date || !(date instanceof Date)) {
    return "00:00";
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Format a Date object as readable date string.
 * Accepts only Date, never Firestore Timestamp.
 */
export function formatDate(date: Date | null | undefined): string {
  if (!date || !(date instanceof Date)) {
    return "";
  }
  return date.toLocaleDateString([], { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

export function formatUser(user?: User | null): string {
  if (!user) return "Unknown";
  return `${user.firstName} ${user.lastName}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}
