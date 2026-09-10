// lib/booking/rules.ts
// Règles métier de réservation partagées entre le front (panier) et l'API
// (source de vérité). Toute règle ajoutée ici s'applique donc aux deux.

import type { Category, Participant, Slot, WPTEvent } from "@/types/firestore";

/** Minimum de créneaux par réservation quand l'événement ne précise rien. */
export const MIN_SLOTS_PER_BOOKING_DEFAULT = 2;

/** Nombre de participants par créneau quand la catégorie ne précise rien. */
export const PARTICIPANTS_PER_SLOT_DEFAULT = 1;

/** Plafond de sécurité pour le champ admin (évite une saisie aberrante). */
export const PARTICIPANTS_PER_SLOT_MAX = 4;

export function getMinSlotsPerBooking(event?: Pick<WPTEvent, "minSlotsPerBooking"> | null): number {
  const value = Number(event?.minSlotsPerBooking);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : MIN_SLOTS_PER_BOOKING_DEFAULT;
}

export function getParticipantsPerSlot(
  category?: Pick<Category, "participantsPerSlot"> | null
): number {
  const value = Number(category?.participantsPerSlot);
  if (!Number.isFinite(value) || value < 1) return PARTICIPANTS_PER_SLOT_DEFAULT;
  return Math.min(Math.floor(value), PARTICIPANTS_PER_SLOT_MAX);
}

/** Liste des participants d'un créneau, quel que soit le format stocké. */
export function getSlotParticipants(
  slot: Pick<Slot, "participant" | "participants">
): Participant[] {
  if (Array.isArray(slot.participants) && slot.participants.length > 0) {
    return slot.participants;
  }
  return slot.participant ? [slot.participant] : [];
}

/** Clé d'identité d'un participant (prénom + nom, insensible à la casse). */
export function participantKey(participant: Pick<Participant, "firstName" | "lastName">): string {
  return `${participant.firstName?.trim().toLowerCase() || ""}|${participant.lastName?.trim().toLowerCase() || ""}`;
}

export function isParticipantComplete(participant?: Partial<Participant> | null): boolean {
  return !!participant?.firstName?.trim() && !!participant?.lastName?.trim() && !!participant?.shirtSize;
}

export interface BookingSelectionSlot {
  slotId: string;
  categoryId: string;
  categoryName?: string;
  participants: (Participant | undefined)[];
}

export interface BookingRulesInput {
  slots: BookingSelectionSlot[];
  /** Nombre de participants requis par catégorie (id -> nombre). */
  participantsPerCategory: Record<string, number>;
  /** Nom lisible des catégories (id -> nom), pour les messages. */
  categoryNames?: Record<string, string>;
  minSlots: number;
}

/**
 * Valide une sélection de créneaux. Renvoie la liste des erreurs
 * (vide = sélection valide).
 */
export function validateBookingSelection(input: BookingRulesInput): string[] {
  const { slots, participantsPerCategory, categoryNames = {}, minSlots } = input;
  const errors: string[] = [];

  const nameOf = (categoryId: string) => categoryNames[categoryId] || "cette catégorie";

  // 1️⃣ Minimum de créneaux (ignoré si le panier ne contient que des repas)
  if (slots.length > 0 && slots.length < minSlots) {
    errors.push(
      `Vous devez vous inscrire dans au moins ${minSlots} catégories différentes pour valider votre inscription (une catégorie = un créneau).`
    );
  }

  // 2️⃣ Participants complets et en nombre suffisant
  for (const slot of slots) {
    const required = participantsPerCategory[slot.categoryId] ?? PARTICIPANTS_PER_SLOT_DEFAULT;
    const filled = slot.participants.filter(participant => isParticipantComplete(participant));

    if (filled.length < required) {
      errors.push(
        required > 1
          ? `${nameOf(slot.categoryId)} se dispute à ${required} : renseignez les ${required} participants (nom, prénom et taille de t-shirt).`
          : `Renseignez le participant (nom, prénom et taille de t-shirt) pour ${nameOf(slot.categoryId)}.`
      );
    }

    // Deux fois la même personne sur un créneau en duo
    const keys = filled.map(participant => participantKey(participant!));
    if (new Set(keys).size !== keys.length) {
      errors.push(`${nameOf(slot.categoryId)} : les participants d'un même créneau doivent être différents.`);
    }
  }

  // 3️⃣ Une même personne ne peut pas concourir deux fois dans la même catégorie
  const seenByCategory = new Map<string, Set<string>>();
  for (const slot of slots) {
    const seen = seenByCategory.get(slot.categoryId) ?? new Set<string>();
    for (const participant of slot.participants) {
      if (!isParticipantComplete(participant)) continue;
      const key = participantKey(participant!);
      if (seen.has(key)) {
        errors.push(
          `${participant!.firstName} ${participant!.lastName} est déjà inscrit(e) dans ${nameOf(slot.categoryId)} : une même personne ne peut pas concourir deux fois dans la même catégorie.`
        );
      }
      seen.add(key);
    }
    seenByCategory.set(slot.categoryId, seen);
  }

  return Array.from(new Set(errors));
}
