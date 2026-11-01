// lib/server/booking/checkout-route.ts
// Traitement HTTP commun aux routes de paiement (créneaux et packs).

import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { HttpError, requireUser } from "@/lib/server/auth";
import { createCheckoutSession } from "@/lib/booking/stripe-session";
import {
  attachCheckoutSession,
  CHECKOUT_SESSION_TTL_MS,
  CheckoutError,
  prepareCheckout,
  releaseCheckout,
  type CheckoutInput,
  type PreparedCheckout,
} from "./checkout-service";

const SUPPORTED_LANGS = ["fr", "en", "es", "it"];

export async function handleCheckoutRequest(
  req: NextRequest,
  build: (body: Record<string, any>) => Omit<CheckoutInput, "buyer">
): Promise<NextResponse> {
  let prepared: PreparedCheckout | null = null;
  try {
    const buyer = await requireUser(req.headers, { auth: adminAuth, db: adminDB });
    const body = (await req.json()) as Record<string, any>;
    const lang = SUPPORTED_LANGS.includes(body.lang) ? body.lang : "fr";

    prepared = await prepareCheckout(adminDB, { ...build(body), buyer: { uid: buyer.uid, email: buyer.email } });

    const origin = req.headers.get("origin") || req.nextUrl.origin;
    const session = await createCheckoutSession({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: prepared.lineItems.map(item => ({
        price_data: {
          currency: "eur",
          product_data: { name: item.name, description: item.description },
          unit_amount: item.unitAmountCents,
        },
        quantity: item.quantity,
      })),
      customer_email: buyer.email || undefined,
      // La session expire avant le verrou des créneaux (voir SLOT_LOCK_TTL_MS).
      expires_at: Math.floor((Date.now() + CHECKOUT_SESSION_TTL_MS) / 1000),
      success_url: `${origin}/${lang}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${lang}/booking?canceled=true`,
      metadata: prepared.metadata,
    });
    await attachCheckoutSession(adminDB, prepared, session.id);

    return NextResponse.json({ sessionId: session.id, url: session.url, totalAmount: prepared.totalAmount });
  } catch (error) {
    if (prepared && !(error instanceof CheckoutError)) {
      await releaseCheckout(adminDB, prepared).catch(releaseError =>
        console.error("⚠️ Libération des créneaux impossible:", releaseError)
      );
    }
    if (error instanceof CheckoutError || error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error instanceof CheckoutError ? error.details : undefined },
        { status: error.status }
      );
    }
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      console.error("❌ Stripe:", error.message);
      return NextResponse.json({ error: `Erreur Stripe: ${error.message}` }, { status: 400 });
    }
    console.error("❌ Erreur lors de la création de la session Stripe:", error);
    return NextResponse.json({ error: "Erreur interne du serveur lors de la création de la session Stripe." }, { status: 500 });
  }
}
