// lib/booking/scheduler.ts
// Placement automatique de créneaux offerts.
//
// Pour un participant, on cherche un créneau LIBRE par catégorie demandée, sans
// chevaucher ses passages existants ni ceux qu'on vient de lui attribuer, en
// respectant une pause minimale entre deux passages. Fonctions pures : aucune
// lecture ni écriture en base, donc testables et sans effet de bord.

export interface TimeInterval {
  start: Date;
  end: Date;
  /** Libellé lisible (ex : "Classique 14:04"), pour expliquer un conflit. */
  label?: string;
}

export interface CandidateSlot {
  id: string;
  categoryId: string;
  date: string;
  startTime: Date;
  endTime: Date;
}

export interface PlacementRequest {
  /** Identifiant du participant (prénom|nom|email). */
  key: string;
  /** Passages déjà réservés par cette personne. */
  busy: TimeInterval[];
  /** Catégories à lui offrir. */
  categoryIds: string[];
}

export interface PlacementResult {
  key: string;
  /** Catégorie -> créneau retenu. */
  assignments: { categoryId: string; slot: CandidateSlot }[];
  /** Catégories impossibles à placer, avec la raison. */
  unplaced: { categoryId: string; reason: string }[];
}

const MINUTE = 60 * 1000;

/**
 * Deux plages sont en conflit si elles se chevauchent ou si l'écart entre elles
 * est inférieur à la pause minimale exigée.
 */
export function conflictsWithBreak(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
  breakMinutes: number
): boolean {
  const gap = Math.max(0, breakMinutes) * MINUTE;
  return a.start.getTime() < b.end.getTime() + gap && b.start.getTime() < a.end.getTime() + gap;
}

/** Premier passage qui empêche ce créneau (ou undefined s'il est compatible). */
export function firstConflict(
  slot: { startTime: Date; endTime: Date },
  busy: TimeInterval[],
  breakMinutes: number
): TimeInterval | undefined {
  const interval = { start: slot.startTime, end: slot.endTime };
  return busy.find(other => conflictsWithBreak(interval, other, breakMinutes));
}

const sortByTime = (slots: CandidateSlot[]) =>
  [...slots].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

/**
 * Place les catégories demandées pour UN participant.
 *
 * Recherche avec retour arrière : les catégories qui ont le moins de créneaux
 * compatibles sont traitées en premier, et on maximise le nombre de catégories
 * placées. À nombre égal, la première solution trouvée (créneaux les plus tôt)
 * est retenue. La recherche est bornée pour rester instantanée.
 */
export function placeForParticipant(
  request: PlacementRequest,
  availableSlots: CandidateSlot[],
  breakMinutes: number,
  reservedSlotIds: Set<string> = new Set()
): PlacementResult {
  const categoryIds = Array.from(new Set(request.categoryIds));

  const candidatesByCategory = new Map<string, CandidateSlot[]>();
  for (const categoryId of categoryIds) {
    candidatesByCategory.set(
      categoryId,
      sortByTime(
        availableSlots.filter(
          slot =>
            slot.categoryId === categoryId &&
            !reservedSlotIds.has(slot.id) &&
            !firstConflict(slot, request.busy, breakMinutes)
        )
      )
    );
  }

  // Les plus contraintes d'abord : moins de branches inutiles.
  const ordered = [...categoryIds].sort(
    (a, b) => (candidatesByCategory.get(a)?.length ?? 0) - (candidatesByCategory.get(b)?.length ?? 0)
  );

  let best: { categoryId: string; slot: CandidateSlot }[] = [];
  let explored = 0;
  const EXPLORATION_LIMIT = 50_000;

  const search = (
    index: number,
    chosen: { categoryId: string; slot: CandidateSlot }[],
    busy: TimeInterval[]
  ) => {
    if (explored++ > EXPLORATION_LIMIT) return;
    // Impossible de faire mieux que la meilleure solution actuelle : on coupe.
    if (chosen.length + (ordered.length - index) <= best.length) return;

    if (index === ordered.length) {
      if (chosen.length > best.length) best = [...chosen];
      return;
    }

    const categoryId = ordered[index];
    for (const slot of candidatesByCategory.get(categoryId) ?? []) {
      if (chosen.some(entry => entry.slot.id === slot.id)) continue;
      if (firstConflict(slot, busy, breakMinutes)) continue;

      chosen.push({ categoryId, slot });
      search(index + 1, chosen, [...busy, { start: slot.startTime, end: slot.endTime }]);
      chosen.pop();

      if (best.length === ordered.length) return; // tout est placé
    }

    // Variante où cette catégorie n'est pas placée
    search(index + 1, chosen, busy);
  };

  search(0, [], [...request.busy]);

  const placedIds = new Set(best.map(entry => entry.categoryId));
  const unplaced = categoryIds
    .filter(categoryId => !placedIds.has(categoryId))
    .map(categoryId => {
      const totalFree = availableSlots.filter(
        slot => slot.categoryId === categoryId && !reservedSlotIds.has(slot.id)
      ).length;
      const freeBeforeThisPlan = availableSlots.filter(slot => slot.categoryId === categoryId).length;
      return {
        categoryId,
        reason:
          totalFree === 0 && freeBeforeThisPlan > 0
            ? "Le(s) dernier(s) créneau(x) libre(s) vienne(nt) d'être attribué(s) à un autre participant de cette répartition"
            : totalFree === 0
              ? "Plus aucun créneau libre dans cette catégorie"
            : (candidatesByCategory.get(categoryId)?.length ?? 0) === 0
              ? "Tous les créneaux libres tombent pendant un autre passage ou sans pause suffisante"
              : "Impossible de combiner avec les autres catégories demandées sans chevauchement",
      };
    });

  // Ordre chronologique pour l'affichage
  best.sort((a, b) => a.slot.startTime.getTime() - b.slot.startTime.getTime());
  return { key: request.key, assignments: best, unplaced };
}

/**
 * Répartition globale : chaque participant reçoit ses catégories, et un
 * créneau attribué à l'un n'est plus proposé aux suivants. Les participants
 * les plus contraints (beaucoup de demandes, agenda chargé) passent en premier,
 * pour ne pas se faire prendre les rares créneaux compatibles.
 */
export function planOffers(
  requests: PlacementRequest[],
  availableSlots: CandidateSlot[],
  breakMinutes: number
): PlacementResult[] {
  const reserved = new Set<string>();
  const ordered = [...requests].sort(
    (a, b) =>
      b.categoryIds.length - a.categoryIds.length || b.busy.length - a.busy.length
  );

  const results = new Map<string, PlacementResult>();
  for (const request of ordered) {
    const result = placeForParticipant(request, availableSlots, breakMinutes, reserved);
    result.assignments.forEach(entry => reserved.add(entry.slot.id));
    results.set(request.key, result);
  }

  // On rend les résultats dans l'ordre d'origine
  return requests.map(request => results.get(request.key)!);
}
