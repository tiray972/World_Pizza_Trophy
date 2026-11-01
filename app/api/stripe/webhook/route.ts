// app/api/stripe/webhook/route.ts
// Webhook Stripe. La finalisation est idempotente : Stripe peut réessayer, et
// la page de succès peut avoir déjà enregistré le paiement.
// Une erreur inattendue renvoie 500 pour que Stripe réessaie : un paiement ne
// doit jamais être perdu parce qu'une écriture a échoué.

import Stripe from "stripe";
import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebase/admin";
import { finalizeAndNotify, stripeClient } from "@/lib/server/payments/stripe-adapter";
import { applyRefund } from "@/lib/server/payments/refund";

export async function POST(req: Request) {
    const stripe = stripeClient();
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, signature || "", process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err) {
        console.error("❌ Webhook signature verification failed:", (err as Error).message);
        return new NextResponse("Webhook signature verification failed", { status: 400 });
    }

    try {
        if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.payment_status !== "paid") {
                // Paiement différé : traité à l'événement async_payment_succeeded.
                return new NextResponse(null, { status: 200 });
            }
            const result = await finalizeAndNotify(adminDB, session, "webhook");
            console.log(`✅ [webhook] ${session.id} → ${result.status}` +
                (result.conflicts.length ? ` (${result.conflicts.length} conflit(s) de créneau)` : ""));
        }

        if (event.type === "charge.refunded") {
            const charge = event.data.object as Stripe.Charge;
            const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
            const sessions = paymentIntent
                ? await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 })
                : null;
            const sessionId = sessions?.data[0]?.id;
            if (!sessionId) {
                console.warn(`⚠️ [webhook] Remboursement ${charge.id} sans session Checkout associée`);
            } else {
                const result = await applyRefund(adminDB, {
                    stripeSessionId: sessionId,
                    amountTotalCents: charge.amount,
                    amountRefundedCents: charge.amount_refunded,
                    chargeId: charge.id,
                });
                console.log(`↩️ [webhook] Remboursement ${charge.id} → ${result.status}`);
            }
        }
    } catch (error) {
        console.error(`❌ [webhook] Traitement de ${event.type} impossible:`, error);
        return new NextResponse("Error processing webhook", { status: 500 });
    }

    return new NextResponse(null, { status: 200 });
}
