import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Timestamp } from "firebase/firestore";
import { User } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(timestamp: Timestamp): string {
  if (!timestamp || !timestamp.toDate) return "00:00";
  return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
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
