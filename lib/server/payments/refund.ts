// lib/server/payments/refund.ts
// Remboursement Stripe : statut financier mis à jour, sans rien effacer.
// Les créneaux ne sont PAS libérés automatiquement : un remboursement partiel
// (un repas, un créneau) ne dit pas lequel ; la décision reste à l'administrateur.

import { Timestamp, type Firestore } from "firebase-admin/firestore";

export interface RefundInput {
  stripeSessionId: string;
  amountTotalCents: number;
  amountRefundedCents: number;
  chargeId?: string;
  at?: Date;
}

export interface RefundResult {
  status: "applied" | "unchanged" | "payment_not_found";
  paymentId: string | null;
  fullRefund: boolean;
}

export async function applyRefund(db: Firestore, input: RefundInput): Promise<RefundResult> {
  const now = Timestamp.fromDate(input.at ?? new Date());
  const fullRefund = input.amountTotalCents > 0 && input.amountRefundedCents >= input.amountTotalCents;

  return db.runTransaction(async tx => {
    let paymentSnapshot = await tx.get(db.collection("payments").doc(input.stripeSessionId));
    if (!paymentSnapshot.exists) {
      const legacy = await tx.get(
        db.collection("payments").where("stripeSessionId", "==", input.stripeSessionId).limit(1)
      );
      if (legacy.empty) {
        tx.set(
          db.collection("paymentIncidents").doc(`refund_${input.stripeSessionId}`),
          {
            stripeSessionId: input.stripeSessionId,
            reason: "refund_unmatched",
            details: { amountRefundedCents: input.amountRefundedCents, chargeId: input.chargeId ?? null },
            resolved: false,
            createdAt: now,
            updatedAt: now,
          },
          { merge: true }
        );
        return { status: "payment_not_found", paymentId: null, fullRefund };
      }
      paymentSnapshot = legacy.docs[0];
    }

    const payment = paymentSnapshot.data() || {};
    const amountRefunded = input.amountRefundedCents / 100;
    if (payment.amountRefunded === amountRefunded) {
      return { status: "unchanged", paymentId: paymentSnapshot.id, fullRefund };
    }

    const seats = await tx.get(db.collection("mealSeats").where("paymentId", "==", paymentSnapshot.id));

    tx.update(paymentSnapshot.ref, {
      amountRefunded,
      status: fullRefund ? "refunded" : payment.status,
      needsReview: true,
      refundedAt: now,
      updatedAt: now,
    });
    if (fullRefund) {
      seats.docs.forEach(seat => tx.update(seat.ref, { financialStatus: "refunded", updatedAt: now }));
    }
    tx.set(db.collection("auditLogs").doc(), {
      eventId: payment.eventId ?? null,
      entity: "payment",
      entityId: paymentSnapshot.id,
      action: fullRefund ? "refund.full" : "refund.partial",
      actorUid: "stripe",
      before: { status: payment.status ?? null, amountRefunded: payment.amountRefunded ?? 0 },
      after: { status: fullRefund ? "refunded" : payment.status ?? null, amountRefunded },
      reason: input.chargeId ? `charge ${input.chargeId}` : null,
      at: now,
    });
    return { status: "applied", paymentId: paymentSnapshot.id, fullRefund };
  });
}
