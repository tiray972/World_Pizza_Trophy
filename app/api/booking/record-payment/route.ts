// app/api/booking/record-payment/route.ts
// Appelée par la page de succès. Même finalisation idempotente que le webhook :
// peu importe lequel arrive en premier, la session donne un seul paiement.
// La session est relue chez Stripe : un appel direct ne peut rien enregistrer
// qui n'ait pas été réellement payé.

import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/lib/firebase/admin";
import { finalizeAndNotify, stripeClient } from "@/lib/server/payments/stripe-adapter";

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const session = await stripeClient().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const result = await finalizeAndNotify(adminDB, session, "success_page");

    if (result.status === "payload_missing") {
      // Payé mais réservation introuvable : incident visible dans le dashboard.
      return NextResponse.json(
        { error: "Paiement reçu : l'organisation doit finaliser votre inscription. Vous serez contacté.", code: result.status },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.status === "already_finalized" ? "Payment already recorded" : "Payment recorded",
      paymentId: result.paymentId,
      amount: (session.amount_total || 0) / 100,
      slotsCount: result.slotIds.length,
      needsReview: result.conflicts.length > 0,
    });
  } catch (error) {
    console.error("❌ Error recording payment:", error);
    return NextResponse.json({ error: "Error recording payment" }, { status: 500 });
  }
}
