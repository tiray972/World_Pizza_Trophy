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

/**
 * Liste des participants d'un créneau, quel que soit le format stocké.
 *
 * ⚠️ Un créneau redevenu disponible n'a, par définition, aucun participant :
 * on ignore les données résiduelles d'une réservation abandonnée pour ne
 * jamais afficher le nom d'un candidat sur un créneau libre.
 */
export function getSlotParticipants(
  slot: Pick<Slot, "participant" | "participants"> & { status?: string }
): Participant[] {
  if (slot.status === "available") return [];
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

/** Message unique du minimum de catégories (réutilisé pour le filtrer côté panier). */
export function minSlotsErrorMessage(minSlots: number): string {
  return `Vous devez vous inscrire dans au moins ${minSlots} catégories différentes pour valider votre inscription (une catégorie = un créneau).`;
}

export interface BookingSelectionSlot {
  slotId: string;
  categoryId: string;
  categoryName?: string;
  participants: (Participant | undefined)[];
  /** Horaires du créneau : servent à détecter deux passages simultanés. */
  startTime?: Date | string | null;
  endTime?: Date | string | null;
}

function toTime(value?: Date | string | null): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
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
    errors.push(minSlotsErrorMessage(minSlots));
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

  // 4️⃣ Une même personne ne peut pas passer sur deux créneaux en même temps
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const first = slots[i];
      const second = slots[j];

      const firstStart = toTime(first.startTime);
      const firstEnd = toTime(first.endTime) ?? firstStart;
      const secondStart = toTime(second.startTime);
      const secondEnd = toTime(second.endTime) ?? secondStart;
      if (firstStart === null || secondStart === null) continue;

      const overlap = firstStart < (secondEnd ?? secondStart) && secondStart < (firstEnd ?? firstStart);
      if (!overlap) continue;

      const firstKeys = new Set(
        first.participants.filter(isParticipantComplete).map(participant => participantKey(participant!))
      );
      const shared = second.participants
        .filter(isParticipantComplete)
        .filter(participant => firstKeys.has(participantKey(participant!)));

      for (const participant of shared) {
        errors.push(
          `${participant!.firstName} ${participant!.lastName} est inscrit(e) sur deux créneaux à la même heure (${nameOf(first.categoryId)} et ${nameOf(second.categoryId)}) : choisissez un autre horaire.`
        );
      }
    }
  }

  return Array.from(new Set(errors));
}
