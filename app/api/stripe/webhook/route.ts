// app/api/stripe/webhook/route.ts

import { adminDB } from "@/lib/firebase/admin"; // Assurez-vous que le chemin est correct
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Payment } from "@/types/firestore"; // Maintenant disponible
import * as admin from "firebase-admin";
import { sendPaymentNotifications } from "@/lib/email/payment-notifications";
import { markPendingBookingPaid, resolveBookingPayload } from "@/lib/booking/pending-booking";

// Initialisation de Stripe (utilisation de la variable d'environnement)
// On utilise 'as any' car ce code est exécuté côté serveur (Next.js API route)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2023-10-16' as Stripe.LatestApiVersion, 
});

interface PaymentParticipant {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    shirtSize?: string;
}

interface PaymentMealGuest {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    isParticipant?: boolean;
}

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
            isPack: isPackString,               // 'true' ou 'false'
            packName,                          // Nom du pack (si existant)
            userEmail,                         // Email de l'utilisateur
            eventId,                           // Event ID from metadata
            mealPrice: mealPriceString,
            mealQuantity: mealQuantityString,
            bookingRef
        } = session.metadata as { 
            userId: string, 
            isPack: string,
            packName?: string,
            userEmail: string,
            eventId?: string,
            mealPrice?: string,
            mealQuantity?: string,
            bookingRef?: string
        };
        
        const amountTotal = session.amount_total || 0;

        // 📦 La charge utile vit dans Firestore (metadata Stripe limitée à 500 caractères)
        const bookingPayload = await resolveBookingPayload(session);

        if (userId && bookingPayload && eventId) {
            
            const slotsData = bookingPayload.slots as Array<{ slotId: string; participant?: PaymentParticipant }>;

            const isPack = isPackString === 'true';
            const mealPrice = Number(mealPriceString || 0);
            const mealQuantity = Number(mealQuantityString || 0);
            const mealGuests = bookingPayload.mealGuests as PaymentMealGuest[];

            if (slotsData.length === 0 && mealGuests.length === 0) {
                console.error("❌ No slots or meals found in metadata.");
                return new NextResponse("No slots or meals found in metadata", { status: 400 });
            }

            try {
                const existingPaymentQuery = await adminDB
                    .collection("payments")
                    .where("stripeSessionId", "==", session.id)
                    .limit(1)
                    .get();

                if (!existingPaymentQuery.empty) {
                    console.log(`⚠️ Payment already recorded for session ${session.id}`);
                    return new NextResponse(null, { status: 200 });
                }

                const batch = adminDB.batch();

                // 1️⃣ Enregistrer le paiement
                const slotIds = slotsData.map((slot) => slot.slotId);
                const paymentRecord: Payment = {
                    id: session.id,
                    eventId: eventId,
                    userId: userId,
                    stripeSessionId: session.id,
                    amount: amountTotal / 100,
                    status: "paid",
                    source: "stripe",
                    slotIds: slotIds,
                    isPack: isPack,
                    packName: isPack ? packName : undefined,
                    metadata: {
                        ...(session.metadata || {}),
                        slotsToReserve: JSON.stringify(slotsData),
                        mealGuests: JSON.stringify(mealGuests),
                    } as Payment["metadata"],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                const paymentRef = adminDB.collection("payments").doc();
                const paymentToSave = Object.fromEntries(
                    Object.entries({
                        ...paymentRecord,
                        createdAt: admin.firestore.Timestamp.fromDate(paymentRecord.createdAt),
                        updatedAt: admin.firestore.Timestamp.fromDate(paymentRecord.updatedAt),
                    }).filter(([, value]) => value !== undefined)
                );
                batch.set(paymentRef, paymentToSave);

                console.log(`✅ Payment recorded: ${paymentRef.id} for user ${userId}`);

                // 2️⃣ Récupérer les catégories des slots et mettre à jour les slots
                const categoryIds = new Set<string>();
                const participantsForEmail: PaymentParticipant[] = [];
                for (const slotInfo of slotsData) {
                    const slotId = slotInfo.slotId;
                    const participant = slotInfo.participant;
                    if (participant) participantsForEmail.push(participant);
                    
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
                let userDataForEmail: admin.firestore.DocumentData | undefined;

                if (userDoc.exists) {
                    userDataForEmail = userDoc.data();
                }
                
                if (slotIds.length > 0 && userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData) {
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
                        console.warn(`⚠️ User data is empty: ${userId}`);
                    }
                } else if (slotIds.length > 0) {
                    console.warn(`⚠️ User document not found: ${userId}`);
                }

                // Exécuter le batch
                await batch.commit();
                await markPendingBookingPaid(bookingRef);
                console.log(`✅ Webhook processing COMPLETED for session ${session.id}`);

                try {
                    const eventDoc = await adminDB.collection("events").doc(eventId).get();
                    await sendPaymentNotifications({
                        userEmail,
                        userName: userDataForEmail ? `${userDataForEmail.firstName || ""} ${userDataForEmail.lastName || ""}`.trim() : undefined,
                        eventName: eventDoc.exists ? eventDoc.data()?.name : undefined,
                        amount: amountTotal / 100,
                        sessionId: session.id,
                        isPack,
                        packName,
                        slotCount: slotIds.length,
                        participants: participantsForEmail,
                        mealGuests,
                        mealPrice,
                        mealQuantity,
                    });
                } catch (emailError) {
                    console.error("❌ Payment emails failed:", emailError);
                }
                
            } catch (batchError) {
                console.error("❌ Error processing webhook batch:", batchError);
                return new NextResponse("Error processing payment", { status: 500 });
            }
        } else {
            console.warn(`⚠️ Missing required metadata: userId=${userId}, bookingPayload=${!!bookingPayload}, eventId=${eventId}`);
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
