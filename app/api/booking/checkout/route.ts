import { NextResponse, NextRequest } from "next/server"; // Importation corrigée
import { adminDB } from "@/lib/firebase/admin"; // Chemin corrigé
import Stripe from 'stripe';

// Initialisation de Stripe (utilisation de la variable d'environnement)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2023-10-16' as any, // Correction du typage strict pour la version d'API
});

// Le chemin d'API est /api/booking/checkout
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { slotsToReserve, userId, userEmail } = body;

        // 1. Validation des données d'entrée
        if (!slotsToReserve || slotsToReserve.length === 0 || !userId || !userEmail) {
            return NextResponse.json({ error: "Données de créneaux manquantes." }, { status: 400 });
        }

        const lineItems = [];
        const availableSlots = [];
        
        // 2. Vérification de la disponibilité des slots et préparation des line items Stripe
        for (const slot of slotsToReserve) {
            const slotRef = adminDB.collection("slots").doc(slot.slotId);
            const slotDoc = await slotRef.get();

            if (!slotDoc.exists || slotDoc.data()?.status !== 'available') {
                return NextResponse.json({ error: `Créneau non disponible ou inexistant: ${slot.slotId}` }, { status: 400 });
            }

            // Récupérer le prix du produit associé à cette catégorie (pour les line items Stripe)
            const categoryId = slotDoc.data()!.categoryId;
            const categoryDoc = await adminDB.collection("categories").doc(categoryId).get();

            if (!categoryDoc.exists) {
                return NextResponse.json({ error: `Catégorie non trouvée pour le slot ${slot.slotId}` }, { status: 404 });
            }

            const categoryPrice = categoryDoc.data()?.unitPrice;
            const categoryStripePriceId = categoryDoc.data()?.stripePriceId; // Assurez-vous d'avoir cet ID dans Firestore

            if (!categoryStripePriceId) {
                return NextResponse.json({ error: `Prix Stripe manquant pour la catégorie ${categoryId}` }, { status: 500 });
            }

            lineItems.push({
                price: categoryStripePriceId, // ID du prix Stripe
                quantity: 1,
            });
            availableSlots.push({ ref: slotRef, data: slotDoc.data() });
        }


        // 3. Création de la Session Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${req.headers.get('origin')}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.get('origin')}/booking?canceled=true`,
            
            // Stocker les métadonnées pour le fulfillment (créneaux + utilisateur)
            metadata: {
                userId: userId,
                userEmail: userEmail,
                // Stocker les IDs des slots en chaîne JSON
                slotsToReserve: JSON.stringify(slotsToReserve.map((s: any) => s.slotId)), 
                isPack: 'false',
            },
        });

        // 4. Temporairement, marquer les slots comme 'pending' (ou 'locked') en les liant à la session Stripe
        // Cette étape est critique pour éviter qu'un autre utilisateur les prenne pendant le paiement.
        const batch = adminDB.batch();
        availableSlots.forEach(({ ref }) => {
            batch.update(ref, {
                status: 'pending', // Statut "en attente de paiement"
                stripeSessionId: session.id,
                userId: userId, // On pré-réserve pour cet utilisateur
            });
        });
        await batch.commit();


        return NextResponse.json({ sessionId: session.id, url: session.url });

    } catch (error) {
        console.error("Erreur lors de la création de la session Stripe:", error);
        return NextResponse.json({ error: "Erreur interne du serveur lors de la création de la session Stripe." }, { status: 500 });
    }
}
