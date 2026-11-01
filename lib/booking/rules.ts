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

/** Messages de validation, dans la langue du Booking (le serveur répond dans la même langue). */
const RULE_MESSAGES = {
  fr: {
    thisCategory: "cette catégorie",
    minSlots: "Vous devez vous inscrire dans au moins {min} catégories différentes pour valider votre inscription (une catégorie = un créneau).",
    teamRequired: "{category} se dispute à {count} : renseignez les {count} participants (nom, prénom et taille de t-shirt).",
    participantRequired: "Renseignez le participant (nom, prénom et taille de t-shirt) pour {category}.",
    sameSlotDuplicate: "{category} : les participants d'un même créneau doivent être différents.",
    sameCategoryTwice: "{name} est déjà inscrit(e) dans {category} : une même personne ne peut pas concourir deux fois dans la même catégorie.",
    overlap: "{name} est inscrit(e) sur deux créneaux à la même heure ({first} et {second}) : choisissez un autre horaire.",
  },
  en: {
    thisCategory: "this category",
    minSlots: "You must register in at least {min} different categories to complete your registration (one category = one slot).",
    teamRequired: "{category} is contested by {count}: fill in all {count} participants (first name, last name and T-shirt size).",
    participantRequired: "Fill in the participant (first name, last name and T-shirt size) for {category}.",
    sameSlotDuplicate: "{category}: participants on the same slot must be different people.",
    sameCategoryTwice: "{name} is already registered in {category}: the same person cannot compete twice in the same category.",
    overlap: "{name} is booked on two slots at the same time ({first} and {second}): choose another time.",
  },
  es: {
    thisCategory: "esta categoría",
    minSlots: "Debes inscribirte en al menos {min} categorías diferentes para validar tu inscripción (una categoría = un horario).",
    teamRequired: "{category} se disputa entre {count}: indica los {count} participantes (nombre, apellido y talla de camiseta).",
    participantRequired: "Indica el participante (nombre, apellido y talla de camiseta) para {category}.",
    sameSlotDuplicate: "{category}: los participantes de un mismo horario deben ser personas distintas.",
    sameCategoryTwice: "{name} ya está inscrito/a en {category}: una misma persona no puede competir dos veces en la misma categoría.",
    overlap: "{name} está inscrito/a en dos horarios a la misma hora ({first} y {second}): elige otro horario.",
  },
  it: {
    thisCategory: "questa categoria",
    minSlots: "Devi iscriverti ad almeno {min} categorie diverse per convalidare l'iscrizione (una categoria = un orario).",
    teamRequired: "{category} si disputa in {count}: inserisci i {count} partecipanti (nome, cognome e taglia della maglietta).",
    participantRequired: "Inserisci il partecipante (nome, cognome e taglia della maglietta) per {category}.",
    sameSlotDuplicate: "{category}: i partecipanti di uno stesso orario devono essere persone diverse.",
    sameCategoryTwice: "{name} è già iscritto/a in {category}: la stessa persona non può gareggiare due volte nella stessa categoria.",
    overlap: "{name} è iscritto/a a due orari alla stessa ora ({first} e {second}): scegli un altro orario.",
  },
};

function messagesFor(lang?: string) {
  return RULE_MESSAGES[(lang === "en" || lang === "es" || lang === "it" ? lang : "fr") as keyof typeof RULE_MESSAGES];
}

const fillMessage = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));

/** Message unique du minimum de catégories (réutilisé pour le filtrer côté panier). */
export function minSlotsErrorMessage(minSlots: number, lang?: string): string {
  return fillMessage(messagesFor(lang).minSlots, { min: minSlots });
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
  /** Langue des messages (fr par défaut). */
  lang?: string;
}

/**
 * Valide une sélection de créneaux. Renvoie la liste des erreurs
 * (vide = sélection valide).
 */
export function validateBookingSelection(input: BookingRulesInput): string[] {
  const { slots, participantsPerCategory, categoryNames = {}, minSlots, lang } = input;
  const errors: string[] = [];
  const messages = messagesFor(lang);

  const nameOf = (categoryId: string) => categoryNames[categoryId] || messages.thisCategory;

  // 1️⃣ Minimum de créneaux (ignoré si le panier ne contient que des repas)
  if (slots.length > 0 && slots.length < minSlots) {
    errors.push(minSlotsErrorMessage(minSlots, lang));
  }

  // 2️⃣ Participants complets et en nombre suffisant
  for (const slot of slots) {
    const required = participantsPerCategory[slot.categoryId] ?? PARTICIPANTS_PER_SLOT_DEFAULT;
    const filled = slot.participants.filter(participant => isParticipantComplete(participant));

    if (filled.length < required) {
      errors.push(
        required > 1
          ? fillMessage(messages.teamRequired, { category: nameOf(slot.categoryId), count: required })
          : fillMessage(messages.participantRequired, { category: nameOf(slot.categoryId) })
      );
    }

    // Deux fois la même personne sur un créneau en duo
    const keys = filled.map(participant => participantKey(participant!));
    if (new Set(keys).size !== keys.length) {
      errors.push(fillMessage(messages.sameSlotDuplicate, { category: nameOf(slot.categoryId) }));
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
          fillMessage(messages.sameCategoryTwice, { name: `${participant!.firstName} ${participant!.lastName}`, category: nameOf(slot.categoryId) })
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
          fillMessage(messages.overlap, { name: `${participant!.firstName} ${participant!.lastName}`, first: nameOf(first.categoryId), second: nameOf(second.categoryId) })
        );
      }
    }
  }

  return Array.from(new Set(errors));
}
