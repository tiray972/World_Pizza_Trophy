// lib/server/events/duplicate.ts
// « Préparer une nouvelle édition à partir de… » : copie de la CONFIGURATION
// uniquement, avec de nouveaux identifiants et des liens remappés.
//
// Copié : catégories (format, tarif, durée, capacité, équipe), produits et packs
// (tarifs, repas inclus, exclusions remappées), règlements (en brouillon, à
// republier), paramètres (prix du repas, minimum de catégories).
// Jamais copié : inscriptions, participants, équipes, dossards, occupation des
// créneaux, commandes, paiements, factures, repas et pointages, acceptations,
// résultats, historiques d'envoi, codes promo, identifiants Stripe.
//
// L'édition créée est un BROUILLON : aucune vente ouverte, jamais rendue
// publique automatiquement. Les prix sont marqués « repris — à vérifier ».
// Idempotent : un `requestId` donné ne crée qu'une seule édition (double clic,
// reprise après erreur).

import { Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { toDateOrNull } from "@/lib/domain/event-lifecycle";
import { instantFromWallTime, isIsoDate, wallTime } from "@/lib/domain/timezone";
import { ParticipantActionError, type ActionContext } from "@/lib/server/participants/service";

export interface DuplicationPreview {
  source: { id: string; name: string; eventYear: number; status: string };
  categories: Array<{ id: string; name: string; unitPrice: number; participantsPerSlot: number; durationMinutes: number; maxSlots: number; isActive: boolean; rulesVersion: number | null; rulesLangs: string[] }>;
  products: Array<{ id: string; name: string; unitAmount: number; slotsRequired: number; mealsIncluded: number; excludedCategoryNames: string[]; isActive: boolean }>;
  mealPrice: number;
  minSlotsPerBooking: number | null;
  days: Array<{ index: number; sourceDate: string; slots: number; categories: string[]; firstStart: string; lastEnd: string }>;
  notCopied: string[];
}

const NOT_COPIED = [
  "inscriptions et participants",
  "équipes et dossards",
  "occupation des créneaux (tous les créneaux générés sont libres)",
  "commandes, paiements et factures",
  "places repas et pointages",
  "acceptations de règlement",
  "résultats et classements",
  "historiques d'envoi d'emails",
  "codes promotionnels",
  "identifiants Stripe et références de paiement",
];

const hhmm = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

export async function previewDuplication(db: Firestore, sourceEventId: string): Promise<DuplicationPreview> {
  const sourceSnapshot = await db.collection("events").doc(sourceEventId).get();
  if (!sourceSnapshot.exists) throw new ParticipantActionError(404, "Édition source introuvable.", "not_found");
  const source = sourceSnapshot.data()!;
  const [categories, products, slots] = await Promise.all([
    db.collection("categories").where("eventId", "==", sourceEventId).get(),
    db.collection("products").where("eventId", "==", sourceEventId).get(),
    db.collection("slots").where("eventId", "==", sourceEventId).get(),
  ]);
  const categoryName = new Map(categories.docs.map(doc => [doc.id, String(doc.data().name ?? doc.id)]));

  const byDate = new Map<string, { starts: Date[]; ends: Date[]; categories: Set<string> }>();
  slots.docs.forEach(doc => {
    const data = doc.data();
    const start = toDateOrNull(data.startTime);
    const end = toDateOrNull(data.endTime);
    if (!start || !end) return;
    const day = wallTime(start).date;
    const entry = byDate.get(day) ?? { starts: [], ends: [], categories: new Set<string>() };
    entry.starts.push(start);
    entry.ends.push(end);
    entry.categories.add(categoryName.get(data.categoryId) ?? data.categoryId);
    byDate.set(day, entry);
  });

  return {
    source: { id: sourceSnapshot.id, name: source.name, eventYear: source.eventYear, status: source.status },
    categories: categories.docs.map(doc => {
      const data = doc.data();
      const published = data.rulesI18n?.published;
      return {
        id: doc.id,
        name: data.name,
        unitPrice: Number(data.unitPrice ?? 0),
        participantsPerSlot: Number(data.participantsPerSlot ?? 1),
        durationMinutes: Number(data.durationMinutes ?? 0),
        maxSlots: Number(data.maxSlots ?? 0),
        isActive: data.isActive !== false,
        rulesVersion: published?.version ?? null,
        rulesLangs: Object.keys(published?.texts ?? data.rulesI18n?.draft?.texts ?? {}),
      };
    }),
    products: products.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        unitAmount: Number(data.unitAmount ?? 0),
        slotsRequired: Number(data.slotsRequired ?? 0),
        mealsIncluded: Number(data.mealsIncluded ?? (data.includesMeal ? 1 : 0)),
        excludedCategoryNames: (data.excludedCategoryIds ?? []).map((id: string) => categoryName.get(id) ?? `(catégorie inconnue ${id})`),
        isActive: data.isActive !== false,
      };
    }),
    mealPrice: Number(source.mealPrice ?? 0),
    minSlotsPerBooking: typeof source.minSlotsPerBooking === "number" ? source.minSlotsPerBooking : null,
    days: Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sourceDate, entry], index) => {
        const first = wallTime(new Date(Math.min(...entry.starts.map(date => date.getTime()))));
        const last = wallTime(new Date(Math.max(...entry.ends.map(date => date.getTime()))));
        return { index, sourceDate, slots: entry.starts.length, categories: [...entry.categories].sort(), firstStart: hhmm(first.hour, first.minute), lastEnd: hhmm(last.hour, last.minute) };
      }),
    notCopied: NOT_COPIED,
  };
}

export interface DuplicationInput {
  sourceEventId: string;
  requestId: string;
  name: string;
  eventYear: number;
  eventStartDate: string;
  eventEndDate: string;
  registrationDeadline: string;
  /** Nouvelle date pour chaque jour source (même ordre que l'aperçu) ; vide = pas de créneaux. */
  dayMapping?: (string | null)[];
}

export interface DuplicationResult {
  eventId: string;
  created: boolean;
  categories: number;
  products: number;
  slots: number;
}

export async function duplicateEdition(db: Firestore, input: DuplicationInput, context: ActionContext): Promise<DuplicationResult> {
  if (!/^[\w-]{6,80}$/.test(input.requestId || "")) throw new ParticipantActionError(400, "Identifiant de requête invalide.", "invalid_request_id");
  if (!input.name?.trim() || !Number.isInteger(Number(input.eventYear))) throw new ParticipantActionError(400, "Nom et année obligatoires.", "invalid_input");
  for (const value of [input.eventStartDate, input.eventEndDate, input.registrationDeadline]) {
    if (!isIsoDate(value)) throw new ParticipantActionError(400, "Dates de l'édition obligatoires (début, fin, date limite).", "dates_required");
  }
  const mapping = (input.dayMapping ?? []).map(value => (value ? value : null));
  if (mapping.some(value => value !== null && !isIsoDate(value))) throw new ParticipantActionError(400, "Date de jour invalide.", "invalid_day");
  const mapped = mapping.filter(Boolean) as string[];
  if (new Set(mapped).size !== mapped.length) throw new ParticipantActionError(400, "Deux jours source ne peuvent pas aller sur la même date.", "duplicate_day");

  const requestRef = db.collection("duplicationRequests").doc(input.requestId);
  const eventId = `evt_${input.requestId}`;
  const eventRef = db.collection("events").doc(eventId);
  const at = Timestamp.fromDate(context.now ?? new Date());

  const existing = await requestRef.get();
  if (existing.exists) return { ...(existing.data()!.result as DuplicationResult), created: false };

  const [source, categories, products, slots] = await Promise.all([
    db.collection("events").doc(input.sourceEventId).get(),
    db.collection("categories").where("eventId", "==", input.sourceEventId).get(),
    db.collection("products").where("eventId", "==", input.sourceEventId).get(),
    db.collection("slots").where("eventId", "==", input.sourceEventId).get(),
  ]);
  if (!source.exists) throw new ParticipantActionError(404, "Édition source introuvable.", "not_found");
  const sourceData = source.data()!;
  const preview = await previewDuplication(db, input.sourceEventId);
  const dateForSourceDay = new Map(preview.days.map(day => [day.sourceDate, mapping[day.index] ?? null]));

  const categoryIdMap = new Map(categories.docs.map(doc => [doc.id, `${eventId}_${doc.id}`]));
  const sourceRef = { eventId: input.sourceEventId, eventName: sourceData.name ?? "", eventYear: sourceData.eventYear ?? null };
  const writes: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];

  writes.push({
    ref: eventRef,
    data: {
      name: input.name.trim(),
      eventYear: Number(input.eventYear),
      eventStartDate: Timestamp.fromDate(instantFromWallTime(input.eventStartDate, 0, 0)),
      eventEndDate: Timestamp.fromDate(instantFromWallTime(input.eventEndDate, 23, 59)),
      registrationDeadline: Timestamp.fromDate(instantFromWallTime(input.registrationDeadline, 23, 59)),
      status: "draft",
      mealPrice: Number(sourceData.mealPrice ?? 0),
      minSlotsPerBooking: sourceData.minSlotsPerBooking ?? 2,
      rulesAcceptanceRequired: true,
      copiedFrom: { ...sourceRef, at, by: context.actor.uid },
      review: { prices: "to_check", rules: "to_publish", slots: mapped.length ? "generated_to_check" : "to_create", publicInfo: "to_check" },
      createdAt: at,
    },
  });

  categories.docs.forEach(doc => {
    const data = doc.data();
    const texts = data.rulesI18n?.published?.texts ?? data.rulesI18n?.draft?.texts ?? {};
    const activeDates = Array.from(new Set((data.activeDates ?? []).map((date: string) => dateForSourceDay.get(date)).filter(Boolean)));
    writes.push({
      ref: db.collection("categories").doc(categoryIdMap.get(doc.id)!),
      data: {
        eventId,
        name: data.name ?? "",
        nameI18n: data.nameI18n ?? {},
        description: data.description ?? "",
        rules: data.rules ?? "",
        unitPrice: Number(data.unitPrice ?? 0),
        maxSlots: Number(data.maxSlots ?? 0),
        durationMinutes: Number(data.durationMinutes ?? 0),
        participantsPerSlot: Number(data.participantsPerSlot ?? 1),
        isActive: data.isActive !== false,
        activeDates,
        // Règlement repris en brouillon : il doit être relu et republié pour cette édition.
        rulesI18n: { draft: { texts, updatedAt: at, updatedBy: context.actor.uid } },
        copiedFrom: { ...sourceRef, categoryId: doc.id, unitPrice: Number(data.unitPrice ?? 0), rulesVersion: data.rulesI18n?.published?.version ?? null },
        priceReview: "to_check",
      },
    });
  });

  products.docs.forEach(doc => {
    const data = doc.data();
    writes.push({
      ref: db.collection("products").doc(`${eventId}_${doc.id}`),
      data: {
        eventId,
        name: data.name ?? "",
        description: data.description ?? "",
        stripePriceId: "",
        unitAmount: Number(data.unitAmount ?? 0),
        slotsRequired: Number(data.slotsRequired ?? 0),
        isPack: data.isPack !== false,
        includesMeal: !!data.includesMeal,
        mealsIncluded: Number(data.mealsIncluded ?? (data.includesMeal ? 1 : 0)),
        // Exclusions remappées vers les catégories de la nouvelle édition.
        excludedCategoryIds: (data.excludedCategoryIds ?? []).map((id: string) => categoryIdMap.get(id)).filter(Boolean),
        isActive: data.isActive !== false,
        copiedFrom: { ...sourceRef, productId: doc.id, unitAmount: Number(data.unitAmount ?? 0) },
        priceReview: "to_check",
      },
    });
  });

  let slotCount = 0;
  slots.docs.forEach(doc => {
    const data = doc.data();
    const start = toDateOrNull(data.startTime);
    const end = toDateOrNull(data.endTime);
    if (!start || !end || !categoryIdMap.has(data.categoryId)) return;
    const startWall = wallTime(start);
    const targetDate = dateForSourceDay.get(startWall.date);
    if (!targetDate) return;
    const endWall = wallTime(end);
    const newStart = instantFromWallTime(targetDate, startWall.hour, startWall.minute);
    const newEnd = instantFromWallTime(targetDate, endWall.hour, endWall.minute);
    slotCount++;
    writes.push({
      ref: db.collection("slots").doc(`${eventId}_${doc.id}`),
      // Créneau neuf et libre : aucune donnée de l'ancienne réservation.
      data: { eventId, categoryId: categoryIdMap.get(data.categoryId), date: targetDate, startTime: Timestamp.fromDate(newStart), endTime: Timestamp.fromDate(newEnd), status: "available", stripeSessionId: null },
    });
  });

  const result: DuplicationResult = { eventId, created: true, categories: categories.size, products: products.size, slots: slotCount };
  writes.push({
    ref: db.collection("auditLogs").doc(`dup_${input.requestId}`),
    data: { eventId, entity: "event", entityId: eventId, action: "event.duplicate", actorUid: context.actor.uid, actorName: context.actor.displayName, before: null, after: { ...sourceRef, ...result }, reason: null, at },
  });

  // La requête est réservée en premier : un second appel simultané échoue ici
  // (document déjà créé) au lieu de créer une deuxième édition.
  try {
    await requestRef.create({ sourceEventId: input.sourceEventId, eventId, status: "in_progress", requestedBy: context.actor.uid, createdAt: at });
  } catch {
    const winner = await requestRef.get();
    const data = winner.data();
    if (data?.status === "done") return { ...(data.result as DuplicationResult), created: false };
    throw new ParticipantActionError(409, "Cette duplication est déjà en cours.", "duplication_in_progress");
  }

  // Écritures par lots, identifiants déterministes : une reprise réécrit les mêmes documents.
  for (let index = 0; index < writes.length; index += 400) {
    const batch = db.batch();
    writes.slice(index, index + 400).forEach(write => batch.set(write.ref, write.data));
    await batch.commit();
  }
  await requestRef.update({ status: "done", result, completedAt: Timestamp.now() });
  return result;
}

/** Reprise d'une duplication interrompue : relance les mêmes écritures, sans doublon. */
export async function resumeDuplication(db: Firestore, input: DuplicationInput, context: ActionContext): Promise<DuplicationResult> {
  const requestRef = db.collection("duplicationRequests").doc(input.requestId);
  const snapshot = await requestRef.get();
  if (snapshot.exists && snapshot.data()!.status === "in_progress") await requestRef.delete();
  return duplicateEdition(db, input, context);
}
