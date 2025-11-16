// app/api/stripe/webhook/route.ts

import { adminDB } from "@/lib/firebase/admin"; // Assurez-vous que le chemin est correct
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Payment } from "@/types/firestore"; // Maintenant disponible
import { FieldValue } from "firebase-admin/firestore";

// Initialisation de Stripe (utilisation de la variable d'environnement)
// On utilise 'as any' car ce code est exécuté côté serveur (Next.js API route)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2023-10-16' as any, 
});

// La route d'API est /api/stripe/webhook
export async function POST(req: Request) {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature")!;

    let event: Stripe.Event;

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
        const { 
            userId, 
            slotsToReserve: slotsToReserveJson, // JSON string des IDs
            isPack: isPackString,               // 'true' ou 'false'
            packName,                          // Nom du pack (si existant)
            userEmail                          // Email de l'utilisateur
        } = session.metadata as { 
            userId: string, 
            slotsToReserve: string, 
            isPack: string,
            packName?: string,
            userEmail: string
        };
        
        const amountTotal = session.amount_total || 0;

        if (userId && slotsToReserveJson) {
            
            let slotIds: string[] = [];
            try {
                // Le contenu est un string JSON, on doit le parser
                slotIds = JSON.parse(slotsToReserveJson);
                if (!Array.isArray(slotIds) || slotIds.length === 0) {
                    throw new Error("slotsToReserve is invalid or empty.");
                }
            } catch (e) {
                console.error("Failed to parse slotsToReserve metadata:", slotsToReserveJson, e);
                return new NextResponse("Invalid slot data in metadata", { status: 400 });
            }

            const isPack = isPackString === 'true';

            // Démarrer une transaction batch pour garantir l'atomicité
            const batch = adminDB.batch();

            // 1. Enregistrer le paiement
            const paymentRecord: Payment = {
                id: session.id, // Utilisé pour le typage, l'ID réel sera généré par addDoc
                userId: userId,
                stripeSessionId: session.id,
                amount: amountTotal / 100, // Convertir les centimes en unité
                status: "paid",
                slotIds: slotIds,
                isPack: isPack,
                packName: isPack ? packName : undefined,
                metadata: session.metadata as Record<string, any>,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const paymentRef = adminDB.collection("payments").doc(); // Crée un nouvel ID auto-généré
            batch.set(paymentRef, paymentRecord);

            // 2. Mettre à jour TOUS les Slots : Passer de 'pending' à 'paid'
            slotIds.forEach(slotId => {
                const slotRef = adminDB.collection("slots").doc(slotId);
                // Le statut était 'pending' (dans la route de checkout), on le passe à 'paid'
                batch.update(slotRef, {
                    userId: userId,
                    status: "paid",
                    stripeSessionId: session.id,
                });
            });
            
            // 3. Mettre à jour l'utilisateur : marquer l'utilisateur comme payé
            const userRef = adminDB.collection("users").doc(userId);
            batch.update(userRef, {
                paid: true, 
                // Idéalement, on mettrait à jour les categoryIds aussi ici
            });

            // Exécuter le batch
            await batch.commit();
            console.log(`Checkout Session COMPLETED (ID: ${session.id}). ${slotIds.length} slots marked as paid for user ${userId}.`);
        }
    }

    // Gérer les remboursements
    if (event.type === "charge.refunded") {
        // La logique de remboursement complète nécessite une recherche avancée dans la collection 'payments' 
        // et la réinitialisation des slots associés.
        const charge = event.data.object as Stripe.Charge;
        console.log(`Charge refunded: ${charge.id}`);
    }

    return new NextResponse(null, { status: 200 });
}
