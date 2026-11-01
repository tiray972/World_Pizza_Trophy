// lib/server/meals/service.ts
// Places repas : lecture par commande, matérialisation des commandes
// historiques, bénéficiaires et pointage. Jamais de modification du paiement.

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { buildMealOrders, canonicalPayments, derivedSeats, type PaymentView, type SeatView } from "@/lib/domain/meals";
import { canonicalName, isNameComplete } from "@/lib/domain/names";
import { ParticipantActionError, type ActionContext } from "@/lib/server/participants/service";

const toDate = (value: unknown): Date | null =>
  value && typeof value === "object" && "toDate" in value ? (value as { toDate: () => Date }).toDate() : null;

function paymentView(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): PaymentView {
  const data = doc.data() || {};
  return {
    id: doc.id,
    userId: data.userId ?? "",
    stripeSessionId: data.stripeSessionId ?? null,
    status: data.status ?? "paid",
    amount: Number(data.amount ?? 0),
    createdAt: toDate(data.createdAt),
    isPack: !!data.isPack,
    packName: data.packName ?? null,
    metadata: data.metadata ?? {},
    mealSeatIds: data.mealSeatIds ?? [],
    stripeInvoiceNumber: data.stripeInvoiceNumber ?? null,
  };
}

function seatView(doc: FirebaseFirestore.QueryDocumentSnapshot): SeatView {
  const data = doc.data();
  return {
    id: doc.id,
    paymentId: data.paymentId,
    stripeSessionId: data.stripeSessionId ?? null,
    buyerId: data.buyerId ?? "",
    seatIndex: data.seatIndex ?? 0,
    seatsInOrder: data.seatsInOrder ?? 1,
    beneficiary: data.beneficiary ?? null,
    unitPrice: data.unitPrice ?? null,
    includedInPack: !!data.includedInPack,
    financialStatus: data.financialStatus ?? "paid",
    present: !!data.attendance?.present,
    derived: false,
  };
}

export async function mealOverview(db: Firestore, eventId: string) {
  const [payments, seats] = await Promise.all([
    db.collection("payments").where("eventId", "==", eventId).get(),
    db.collection("mealSeats").where("eventId", "==", eventId).get(),
  ]);
  const buyerIds = Array.from(new Set(payments.docs.map(doc => doc.data().userId).filter(Boolean)));
  const buyers = buyerIds.length ? await db.getAll(...buyerIds.map(id => db.collection("users").doc(id))) : [];
  const labels = new Map(
    buyers.map(doc => {
      const data = doc.data() || {};
      const name = [data.lastName ? String(data.lastName).toUpperCase() : "", data.firstName].filter(Boolean).join(" ").trim();
      return [doc.id, name && name !== "User" ? `${name} — ${data.email ?? ""}` : String(data.email || doc.id)];
    })
  );
  return buildMealOrders(payments.docs.map(paymentView), seats.docs.map(seatView), id => labels.get(id) ?? id);
}

/**
 * Crée les documents `mealSeats` d'une commande historique, à l'identique de ce
 * qui a été payé (identifiants déterministes : relancer ne crée rien de plus).
 */
export async function materializeOrderSeats(db: Firestore, paymentId: string, context: ActionContext) {
  const at = Timestamp.fromDate(context.now ?? new Date());
  return db.runTransaction(async tx => {
    const paymentSnapshot = await tx.get(db.collection("payments").doc(paymentId));
    if (!paymentSnapshot.exists) throw new ParticipantActionError(404, "Paiement introuvable.", "not_found");
    const payment = paymentView(paymentSnapshot);
    const existing = await tx.get(db.collection("mealSeats").where("paymentId", "==", paymentId));
    if (!existing.empty) return { created: 0, seatIds: existing.docs.map(doc => doc.id) };
    if (payment.stripeSessionId) {
      const siblings = await tx.get(db.collection("payments").where("stripeSessionId", "==", payment.stripeSessionId));
      const { kept } = canonicalPayments(siblings.docs.map(paymentView));
      if (kept[0] && kept[0].id !== paymentId) {
        throw new ParticipantActionError(409, "Cet enregistrement est un doublon d'une session déjà comptée : ses places ne sont pas créées.", "duplicate_payment_record");
      }
    }
    const seats = derivedSeats(payment);
    const seatIds = seats.map((_, index) => `${paymentId}_m${index + 1}`);
    seats.forEach((seat, index) =>
      tx.create(db.collection("mealSeats").doc(seatIds[index]), {
        eventId: paymentSnapshot.data()!.eventId,
        paymentId,
        stripeSessionId: payment.stripeSessionId,
        buyerId: payment.userId,
        seatIndex: seat.seatIndex,
        seatsInOrder: seat.seatsInOrder,
        beneficiary: seat.beneficiary ? canonicalName(seat.beneficiary) : null,
        beneficiaryParticipantId: null,
        mealLabel: null,
        unitPrice: seat.unitPrice,
        includedInPack: seat.includedInPack,
        source: "migration",
        financialStatus: seat.financialStatus,
        attendance: { present: false },
        createdAt: at,
        updatedAt: at,
      })
    );
    tx.set(db.collection("auditLogs").doc(), {
      eventId: paymentSnapshot.data()!.eventId,
      entity: "payment",
      entityId: paymentId,
      action: "mealSeats.materialize",
      actorUid: context.actor.uid,
      actorName: context.actor.displayName,
      before: null,
      after: { seats: seatIds.length },
      reason: context.reason ?? null,
      at,
    });
    return { created: seatIds.length, seatIds };
  });
}

/** Bénéficiaire d'une place (null = à compléter) et/ou pointage de présence. */
export async function updateSeat(
  db: Firestore,
  input: { seatId: string; beneficiary?: { firstName: string; lastName: string } | null; present?: boolean },
  context: ActionContext
) {
  const at = Timestamp.fromDate(context.now ?? new Date());
  const ref = db.collection("mealSeats").doc(input.seatId);
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new ParticipantActionError(404, "Place introuvable.", "not_found");
    const data = snapshot.data()!;
    const update: Record<string, unknown> = { updatedAt: at };
    if (input.beneficiary !== undefined) {
      const beneficiary = input.beneficiary ? canonicalName(input.beneficiary) : null;
      if (beneficiary && !isNameComplete(beneficiary)) {
        throw new ParticipantActionError(400, "Nom et prénom du bénéficiaire obligatoires.", "name_required");
      }
      update.beneficiary = beneficiary;
      update.beneficiaryParticipantId = null;
      tx.set(db.collection("auditLogs").doc(), {
        eventId: data.eventId,
        entity: "mealSeat",
        entityId: ref.id,
        action: "mealSeat.beneficiary",
        actorUid: context.actor.uid,
        actorName: context.actor.displayName,
        before: { beneficiary: data.beneficiary ?? null },
        after: { beneficiary },
        reason: context.reason ?? null,
        at,
      });
    }
    if (input.present !== undefined) {
      if (data.financialStatus !== "paid") {
        throw new ParticipantActionError(409, "Place non payée (remboursée ou annulée) : pointage impossible.", "seat_not_paid");
      }
      update.attendance = { present: input.present, markedAt: at, markedBy: context.actor.uid };
    }
    tx.update(ref, update);
    return { ok: true };
  });
}
