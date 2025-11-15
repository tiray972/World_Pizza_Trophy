// /types/firestore.ts

import { FieldValue, Timestamp } from "firebase/firestore";

// Type de base pour un utilisateur (pour l'admin SDK)
export interface User {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  country: string;
  phone: string;
  categories: string[]; // IDs des catégories
  paid: boolean;
  role: "user" | "admin";
  stripeCustomerId?: string;
  createdAt: Timestamp;
}

// Type de base pour un slot de compétition
export interface Slot {
    id: string;
    categoryId: string;
    day: 1 | 2;             // NOUVEAU: Le jour du concours (1 ou 2)
    startTime: Timestamp;
    endTime: Timestamp;
    userId: string | null;
    status: "available" | "reserved" | "locked" | "paid";
    stripeSessionId: string | null;
  }

// Type pour enregistrer les transactions
export interface Payment {
  userId: string;
  slotId: string;
  stripeSessionId: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

// /types/firestore.ts (Collection 'products')

export interface Product {
    id: string; // ex: "pack_3_repas"
    name: string; // "Pack 3 Catégories + Repas"
    
    stripePriceId: string; // L'ID du produit dans Stripe (ex: price_123ABC)
    unitAmount: number; // 30000 (en centimes)
    
    // Règle de validation du pack
    slotsRequired: number; // 3
    
    includesMeal: boolean; // true
    
    // Gestion marketing
    isActive: boolean; // true/false (l'admin peut l'activer/désactiver)
    
    description: string; // "Offre spéciale..."
  }

// Type pour une catégorie de compétition
export interface Category {
    id: string; // ex: "cat_pizza_classique"
    name: string; // "Pizza Classique"
    description: string; // "La pizza traditionnelle..."
    maxSlots: number; // 50
    durationMinutes: number; // 10
}