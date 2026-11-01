// lib/server/events/lifecycle.ts
// Changement de statut d'une édition : transitions contrôlées, prérequis
// vérifiés avant l'ouverture des inscriptions, historique. Archiver n'efface
// rien et ne bloque pas le traitement financier tardif (webhook, remboursements).

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { allowedTransitions, EVENT_STATUS_LABELS, toDateOrNull } from "@/lib/domain/event-lifecycle";
import { ParticipantActionError, type ActionContext } from "@/lib/server/participants/service";
import type { EventStatus } from "@/types/firestore";

export interface ReadinessItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  /** Bloque l'ouverture des inscriptions. */
  required: boolean;
}

export async function editionReadiness(db: Firestore, eventId: string, now: Date = new Date()): Promise<ReadinessItem[]> {
  const [event, categories, products, slots] = await Promise.all([
    db.collection("events").doc(eventId).get(),
    db.collection("categories").where("eventId", "==", eventId).get(),
    db.collection("products").where("eventId", "==", eventId).get(),
    db.collection("slots").where("eventId", "==", eventId).get(),
  ]);
  if (!event.exists) throw new ParticipantActionError(404, "Édition introuvable.", "not_found");
  const data = event.data()!;
  const active = categories.docs.filter(doc => doc.data().isActive !== false);
  const withoutRules = active.filter(doc => !doc.data().rulesI18n?.published);
  const pricesToCheck = [...categories.docs, ...products.docs].filter(doc => doc.data().priceReview === "to_check");
  const freeSlots = slots.docs.filter(doc => doc.data().status === "available").length;
  const deadline = toDateOrNull(data.registrationDeadline);

  return [
    { key: "dates", label: "Nom, année et dates", ok: !!data.name && !!toDateOrNull(data.eventStartDate) && !!toDateOrNull(data.eventEndDate), detail: `${data.name ?? "—"} (${data.eventYear ?? "—"})`, required: true },
    { key: "deadline", label: "Date limite d'inscription à venir", ok: !!deadline && deadline.getTime() > now.getTime(), detail: deadline ? deadline.toLocaleDateString("fr-FR") : "non renseignée", required: true },
    { key: "categories", label: "Catégories actives", ok: active.length > 0, detail: `${active.length} catégorie(s) active(s)`, required: true },
    { key: "slots", label: "Créneaux libres", ok: freeSlots > 0, detail: `${freeSlots} créneau(x) libre(s) sur ${slots.size}`, required: true },
    { key: "prices", label: "Prix vérifiés", ok: pricesToCheck.length === 0, detail: pricesToCheck.length ? `${pricesToCheck.length} tarif(s) « repris — à vérifier »` : "tous vérifiés", required: true },
    {
      key: "rules",
      label: "Règlements publiés",
      ok: withoutRules.length === 0,
      detail: withoutRules.length ? `sans règlement publié : ${withoutRules.map(doc => doc.data().name).join(", ")}` : "toutes les catégories actives",
      required: !!data.rulesAcceptanceRequired,
    },
    { key: "meals", label: "Repas", ok: Number(data.mealPrice ?? 0) > 0, detail: `${data.mealPrice ?? 0} €`, required: false },
  ];
}

export async function changeEventStatus(
  db: Firestore,
  input: { eventId: string; to: EventStatus; expectedStatus: EventStatus },
  context: ActionContext
): Promise<{ status: EventStatus }> {
  const at = Timestamp.fromDate(context.now ?? new Date());
  const ref = db.collection("events").doc(input.eventId);
  const assertTransition = (current: EventStatus | undefined) => {
    if (!current) throw new ParticipantActionError(404, "Édition introuvable.", "not_found");
    if (current !== input.expectedStatus) {
      throw new ParticipantActionError(409, `Le statut a changé entre-temps (${EVENT_STATUS_LABELS[current] ?? current}). Rechargez.`, "version_conflict");
    }
    if (!allowedTransitions(current).includes(input.to)) {
      throw new ParticipantActionError(409, `Passage « ${EVENT_STATUS_LABELS[current]} » → « ${EVENT_STATUS_LABELS[input.to] ?? input.to} » non autorisé.`, "transition_refused");
    }
  };
  assertTransition((await ref.get()).data()?.status);
  if (input.to === "open") {
    const missing = (await editionReadiness(db, input.eventId, context.now)).filter(item => item.required && !item.ok);
    if (missing.length > 0) {
      throw new ParticipantActionError(409, `Ouverture impossible : ${missing.map(item => `${item.label} (${item.detail})`).join(" ; ")}.`, "prerequisites_missing", { missing });
    }
  }
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const current = snapshot.data()?.status as EventStatus | undefined;
    // Revérifié dans la transaction : un autre administrateur a pu changer le statut.
    assertTransition(current);
    tx.update(ref, { status: input.to, statusChangedAt: at, statusChangedBy: context.actor.uid });
    tx.set(db.collection("auditLogs").doc(), {
      eventId: input.eventId, entity: "event", entityId: input.eventId, action: "event.status",
      actorUid: context.actor.uid, actorName: context.actor.displayName, before: { status: current }, after: { status: input.to },
      reason: context.reason ?? null, at,
    });
    return { status: input.to };
  });
}

/** L'administrateur confirme avoir vérifié les tarifs repris d'une autre édition. */
export async function confirmPricesReviewed(db: Firestore, eventId: string, context: ActionContext): Promise<{ confirmed: number }> {
  const at = Timestamp.fromDate(context.now ?? new Date());
  const [categories, products] = await Promise.all([
    db.collection("categories").where("eventId", "==", eventId).where("priceReview", "==", "to_check").get(),
    db.collection("products").where("eventId", "==", eventId).where("priceReview", "==", "to_check").get(),
  ]);
  const docs = [...categories.docs, ...products.docs];
  const batch = db.batch();
  docs.forEach(doc => batch.update(doc.ref, { priceReview: "checked", priceReviewedAt: at, priceReviewedBy: context.actor.uid }));
  batch.set(db.collection("auditLogs").doc(), {
    eventId, entity: "event", entityId: eventId, action: "event.prices_reviewed", actorUid: context.actor.uid, actorName: context.actor.displayName,
    before: null, after: { prices: docs.map(doc => ({ id: doc.id, name: doc.data().name, price: doc.data().unitPrice ?? doc.data().unitAmount })) }, reason: context.reason ?? null, at,
  });
  await batch.commit();
  return { confirmed: docs.length };
}
