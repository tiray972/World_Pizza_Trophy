// lib/server/payments/stripe-adapter.ts
// Passerelle entre le SDK Stripe et le service de finalisation, qui reste
// indépendant de Stripe (testable dans l'émulateur).

import Stripe from "stripe";
import type { Firestore } from "firebase-admin/firestore";
import { getSessionInvoice } from "@/lib/booking/stripe-session";
import { sendPaymentNotifications } from "@/lib/email/payment-notifications";
import {
  finalizeCheckoutSession,
  type CheckoutSessionSnapshot,
  type FinalizeResult,
  type FinalizeSource,
} from "./finalize";

export function stripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2023-10-16" as Stripe.LatestApiVersion,
  });
}

export async function snapshotOf(session: Stripe.Checkout.Session): Promise<CheckoutSessionSnapshot> {
  return {
    id: session.id,
    paymentStatus: session.payment_status,
    amountTotal: session.amount_total || 0,
    customerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
    metadata: (session.metadata || {}) as Record<string, string>,
    invoice: session.payment_status === "paid" ? await getSessionInvoice(session) : null,
  };
}

/**
 * Finalise une session et envoie les emails une seule fois (uniquement par
 * l'appel qui a réellement créé le paiement).
 */
export async function finalizeAndNotify(
  db: Firestore,
  session: Stripe.Checkout.Session,
  source: FinalizeSource
): Promise<FinalizeResult> {
  const result = await finalizeCheckoutSession(db, await snapshotOf(session), { source });

  if (result.status === "created" && result.notification) {
    const { notification } = result;
    try {
      const eventDoc = notification.eventId
        ? await db.collection("events").doc(notification.eventId).get()
        : null;
      await sendPaymentNotifications({
        userEmail: notification.userEmail,
        userName: notification.userName,
        eventName: eventDoc?.exists ? eventDoc.data()?.name : undefined,
        amount: notification.amount,
        sessionId: session.id,
        isPack: notification.isPack,
        packName: notification.packName,
        slotCount: result.slotIds.length,
        participants: notification.participants.map(participant => ({
          firstName: participant.firstName || "",
          lastName: participant.lastName || "",
          email: participant.email,
          phone: participant.phone,
          shirtSize: participant.shirtSize,
        })),
        mealGuests: notification.mealGuests.map(guest => ({
          firstName: guest.firstName || "",
          lastName: guest.lastName || "",
          email: guest.email,
          phone: guest.phone,
          isParticipant: guest.isParticipant,
        })),
        mealPrice: notification.mealPrice,
        mealQuantity: notification.mealQuantity,
      });
    } catch (emailError) {
      // Le paiement est enregistré : un email en échec ne doit pas le remettre en cause.
      console.error("❌ Payment emails failed:", emailError);
    }
  }

  return result;
}
