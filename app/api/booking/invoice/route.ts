import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import Stripe from "stripe";
import { getSessionInvoice } from "@/lib/booking/stripe-session";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2023-10-16" as Stripe.LatestApiVersion,
});

/**
 * Récupère (et met en cache) la facture officielle Stripe d'un paiement.
 *
 * Stripe crée la facture de façon asynchrone : au moment où le paiement est
 * enregistré, elle n'existe pas toujours. Cette route la récupère à la demande
 * et complète le document `payments`.
 */
export async function POST(req: NextRequest) {
    try {
        const authorization = req.headers.get("authorization") || "";
        const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
        if (!idToken) {
            return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
        }

        let uid: string;
        try {
            const decoded = await adminAuth.verifyIdToken(idToken);
            uid = decoded.uid;
        } catch {
            return NextResponse.json({ error: "Session expirée." }, { status: 401 });
        }

        const { paymentId } = (await req.json()) as { paymentId?: string };
        if (!paymentId) {
            return NextResponse.json({ error: "Paiement manquant." }, { status: 400 });
        }

        const paymentRef = adminDB.collection("payments").doc(paymentId);
        const paymentDoc = await paymentRef.get();
        if (!paymentDoc.exists) {
            return NextResponse.json({ error: "Paiement introuvable." }, { status: 404 });
        }

        const payment = paymentDoc.data()!;
        // 🔒 Chacun n'accède qu'à ses propres factures
        if (payment.userId !== uid) {
            return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
        }

        if (payment.stripeInvoicePdf || payment.stripeInvoiceUrl) {
            return NextResponse.json({
                available: true,
                number: payment.stripeInvoiceNumber || null,
                pdfUrl: payment.stripeInvoicePdf || null,
                hostedUrl: payment.stripeInvoiceUrl || null,
            });
        }

        if (!payment.stripeSessionId) {
            return NextResponse.json({ available: false });
        }

        const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
        const invoice = await getSessionInvoice(session);

        if (!invoice) {
            return NextResponse.json({ available: false });
        }

        await paymentRef.update({
            stripeInvoiceNumber: invoice.number,
            stripeInvoiceUrl: invoice.hostedUrl,
            stripeInvoicePdf: invoice.pdfUrl,
        });

        return NextResponse.json({
            available: true,
            number: invoice.number,
            pdfUrl: invoice.pdfUrl,
            hostedUrl: invoice.hostedUrl,
        });
    } catch (error) {
        console.error("❌ Erreur lors de la récupération de la facture Stripe:", error);
        return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
    }
}
