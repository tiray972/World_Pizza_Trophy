// lib/booking/stripe-session.ts
// Création des sessions Stripe Checkout avec facture officielle.

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2023-10-16" as Stripe.LatestApiVersion,
});

/**
 * Crée la session Stripe en demandant la génération d'une facture officielle
 * (numérotée par Stripe, PDF hébergé chez eux). Si le compte Stripe n'est pas
 * configuré pour la facturation, on retombe sur une session classique plutôt
 * que de bloquer le paiement.
 */
export async function createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams
): Promise<Stripe.Checkout.Session> {
    try {
        return await stripe.checkout.sessions.create({
            ...params,
            customer_creation: "always",
            invoice_creation: { enabled: true },
        });
    } catch (error) {
        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
            console.warn(
                `⚠️ Facturation Stripe indisponible (${error.message}) — session créée sans facture.`
            );
            return await stripe.checkout.sessions.create(params);
        }
        throw error;
    }
}

/**
 * Récupère les informations de facture d'une session payée.
 * Renvoie null si le compte Stripe n'émet pas de facture.
 */
export async function getSessionInvoice(
    session: Stripe.Checkout.Session
): Promise<{ number: string | null; hostedUrl: string | null; pdfUrl: string | null } | null> {
    const invoiceId = typeof session.invoice === "string" ? session.invoice : session.invoice?.id;
    if (!invoiceId) return null;

    try {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        return {
            number: invoice.number ?? null,
            hostedUrl: invoice.hosted_invoice_url ?? null,
            pdfUrl: invoice.invoice_pdf ?? null,
        };
    } catch (error) {
        console.warn("⚠️ Facture Stripe illisible:", error);
        return null;
    }
}
