// /app/api/stripe/webhook/route.ts (Mise à jour)

import { adminDB } from "@/lib/firebase/admin";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Payment } from "@/types/firestore";

// ... (votre code d'initialisation Stripe et de vérification de signature)

export async function POST(req: Request) {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature")!;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        console.error("Webhook signature verification failed:", (err as Error).message);
        return new NextResponse("Webhook signature verification failed", { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, slotId } = session.metadata as { userId: string, slotId: string };
        const amountTotal = session.amount_total || 0;

        if (userId && slotId) {
            // 1. Enregistrer le paiement
            const paymentRecord: Payment = {
                userId: userId,
                slotId: slotId,
                stripeSessionId: session.id,
                amount: amountTotal / 100, // Convertir les centimes en unité
                status: "paid",
                createdAt: new Date(), // Utiliser l'objet Date pour le serveur Admin
                updatedAt: new Date(),
            };
            await adminDB.collection("payments").add(paymentRecord);

            // 2. Mettre à jour le Slot : Passer de 'locked' à 'paid'
            await adminDB.collection("slots").doc(slotId).update({
                userId: userId,
                status: "paid",
            });
            
            // 3. Mettre à jour l'utilisateur : Marquer l'utilisateur comme 'paid' pour cette catégorie/slot
             await adminDB.collection("users").doc(userId).update({
                paid: true, // Ceci doit être affiné si l'utilisateur paie pour plusieurs slots/catégories
             });
        }
    }

    // Gérer les remboursements
    if (event.type === "charge.refunded") {
        // Logique de mise à jour du statut dans 'payments' et potentiellement 'slots'
        // ...
    }

    return new NextResponse(null, { status: 200 });
}