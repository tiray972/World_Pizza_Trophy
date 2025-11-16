// /types/firestore.ts

import { FieldValue, Timestamp } from "firebase/firestore";

// --- Configuration Globale ---

/** Paramètres de l'événement gérés par l'admin. */
export interface Settings {
    id: 'config';
    eventStartDate: Timestamp;
    eventEndDate: Timestamp;
    registrationDeadline: Timestamp; // Date limite pour les inscriptions/paiements
    eventYear: number;
}

// --- Base de Données ---

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

// --- Produits et Offres ---

/** Représente une catégorie de compétition spécifique */
export interface Category {
    id: string; // ex: "cat_pizza_classique"
    name: string;
    description: string;
    unitPrice: number; 
    maxSlots: number;
    durationMinutes: number;
    activeDays: (1 | 2)[]; // NOUVEAU: Les jours où cette catégorie est active
}

/** * Représente un Pack ou une Offre Spéciale */
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

/** * Représente un Bon ou un Code promotionnel */
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

// --- Réservation ---

export type SlotStatus = 'available' | 'locked' | 'paid' | 'offered';

/** Représente un créneau horaire disponible ou réservé. */
export interface Slot {
    id: string;
    categoryId: string;
    day: 1 | 2;
    startTime: Timestamp;
    endTime: Timestamp;
    userId: string | null;
    status: SlotStatus;
    stripeSessionId: string | null;
}

/** Représente un enregistrement de paiement Stripe. */
export interface Payment {
    id: string; // ID du document de paiement (Firestore)
    userId: string;
    stripeSessionId: string;
    amount: number; // Montant payé en EUR (non centimes)
    status: 'paid' | 'refunded' | 'failed';
    slotIds: string[]; // IDs des slots couverts par ce paiement (peut être 1 ou N pour un pack)
    isPack: boolean; // Indique si le paiement concernait un pack
    packName?: string; // Nom du pack si isPack est true
    metadata: Record<string, any>; // Métadonnées brutes de la session Stripe
    createdAt: Date; // Date d'enregistrement du paiement
    updatedAt: Date;
}
