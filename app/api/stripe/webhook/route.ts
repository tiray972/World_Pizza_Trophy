// app/api/stripe/webhook/route.ts

import { adminDB } from "@/lib/firebase/admin"; // Assurez-vous que le chemin est correct
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Payment } from "@/types/firestore"; // Maintenant disponible
import * as admin from "firebase-admin";

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
        console.error("❌ Webhook signature verification failed:", (err as Error).message);
        return new NextResponse("Webhook signature verification failed", { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const { 
            userId, 
            slotsToReserve: slotsToReserveJson, // JSON string des IDs
            isPack: isPackString,               // 'true' ou 'false'
            packName,                          // Nom du pack (si existant)
            userEmail,                         // Email de l'utilisateur
            eventId                            // Event ID from metadata
        } = session.metadata as { 
            userId: string, 
            slotsToReserve: string, 
            isPack: string,
            packName?: string,
            userEmail: string,
            eventId?: string
        };
        
        const amountTotal = session.amount_total || 0;

        if (userId && slotsToReserveJson) {
            
            let slotsData: Array<{ slotId: string; participant?: any }> = [];
            try {
                slotsData = JSON.parse(slotsToReserveJson);
                if (!Array.isArray(slotsData) || slotsData.length === 0) {
                    throw new Error("slotsToReserve is invalid or empty.");
                }
            } catch (e) {
                console.error("❌ Failed to parse slotsToReserve metadata:", slotsToReserveJson, e);
                return new NextResponse("Invalid slot data in metadata", { status: 400 });
            }

            const isPack = isPackString === 'true';

            try {
                const batch = adminDB.batch();

                // 1️⃣ Enregistrer le paiement
                const slotIds = slotsData.map((s: any) => s.slotId);
                const paymentRecord: Payment = {
                    id: session.id,
                    eventId: eventId || "",
                    userId: userId,
                    stripeSessionId: session.id,
                    amount: amountTotal / 100,
                    status: "paid",
                    source: "stripe",
                    slotIds: slotIds,
                    isPack: isPack,
                    packName: isPack ? packName : undefined,
                    metadata: session.metadata as Record<string, any>,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                const paymentRef = adminDB.collection("payments").doc();
                batch.set(paymentRef, {
                    ...paymentRecord,
                    createdAt: admin.firestore.Timestamp.fromDate(paymentRecord.createdAt),
                    updatedAt: admin.firestore.Timestamp.fromDate(paymentRecord.updatedAt),
                });

                console.log(`✅ Payment recorded: ${paymentRef.id} for user ${userId}`);

                // 2️⃣ Récupérer les catégories des slots et mettre à jour les slots
                const categoryIds = new Set<string>();
                for (const slotInfo of slotsData) {
                    const slotId = slotInfo.slotId;
                    const participant = slotInfo.participant;
                    
                    const slotRef = adminDB.collection("slots").doc(slotId);
                    const slotDoc = await slotRef.get();
                    
                    if (slotDoc.exists) {
                        const slotData = slotDoc.data();
                        categoryIds.add(slotData?.categoryId || "");
                        
                        // Mettre à jour le slot : locked -> paid
                        batch.update(slotRef, {
                            buyerId: userId,
                            status: "paid",
                            participant: participant || null,
                            stripeSessionId: session.id,
                            assignmentType: "payment",
                            paidAt: admin.firestore.Timestamp.fromDate(new Date()),
                        });
                    }
                }

                console.log(`✅ ${slotIds.length} slots updated to 'paid' status`);

                // 3️⃣ Mettre à jour l'utilisateur avec la structure EventRegistration
                const userRef = adminDB.collection("users").doc(userId);
                const userDoc = await userRef.get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const registrations = userData.registrations || {};
                    
                    // Créer ou mettre à jour l'enregistrement pour cet événement
                    if (!registrations[eventId]) {
                        registrations[eventId] = {
                            paid: true,
                            categoryIds: Array.from(categoryIds).filter(id => id),
                            stripeCustomerId: session.customer || undefined,
                            paymentId: paymentRef.id,
                            registeredAt: admin.firestore.Timestamp.fromDate(new Date()),
                        };
                    } else {
                        // Merger avec les catégories existantes
                        const existingCategoryIds = registrations[eventId].categoryIds || [];
                        const allCategoryIds = Array.from(
                            new Set([...existingCategoryIds, ...Array.from(categoryIds).filter(id => id)])
                        );
                        
                        registrations[eventId] = {
                            ...registrations[eventId],
                            paid: true,
                            categoryIds: allCategoryIds,
                            paymentId: paymentRef.id,
                            registeredAt: registrations[eventId].registeredAt || admin.firestore.Timestamp.fromDate(new Date()),
                        };
                    }

                    batch.update(userRef, { registrations });
                    console.log(`✅ User ${userId} registrations updated for event ${eventId}`);
                } else {
                    console.warn(`⚠️ User document not found: ${userId}`);
                }

                // Exécuter le batch
                await batch.commit();
                console.log(`✅ Webhook processing COMPLETED for session ${session.id}`);
                
            } catch (batchError) {
                console.error("❌ Error processing webhook batch:", batchError);
                return new NextResponse("Error processing payment", { status: 500 });
            }
        }
    }

    // Gérer les remboursements
    if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;
        console.log(`⚠️ Charge refunded: ${charge.id}`);
        // TODO: Implémenter la logique de remboursement complet (slots back to available, etc.)
    }

    return new NextResponse(null, { status: 200 });
}
