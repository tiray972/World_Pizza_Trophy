import { NextResponse, NextRequest } from "next/server";
import { adminDB } from "@/lib/firebase/admin";
import Stripe from 'stripe';
import * as admin from "firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2023-10-16' as any,
});

interface SlotWithParticipant {
  slotId: string;
  categoryId: string;
  participant?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { slotsToReserve, userId, userEmail, eventId, totalAmount, lang } = body;

        if (!slotsToReserve || slotsToReserve.length === 0 || !userId || !userEmail || !totalAmount || !lang) {
            return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
        }

        console.log(`🔵 [Checkout] Starting checkout for user ${userId}, event ${eventId}, slots: ${slotsToReserve.length}, total: ${totalAmount}€`);

        const availableSlots = [];
        
        // 1️⃣ Vérification de la disponibilité des slots et verrouillage
        for (const slot of slotsToReserve as SlotWithParticipant[]) {
            try {
                const slotRef = adminDB.collection("slots").doc(slot.slotId);
                const slotDoc = await slotRef.get();

                // Vérifier si le document existe avec la bonne syntaxe
                if (!slotDoc || !slotDoc.exists) {
                    console.error(`❌ Slot ${slot.slotId} does not exist`);
                    return NextResponse.json({ error: `Créneau inexistant: ${slot.slotId}` }, { status: 400 });
                }

                const slotData = slotDoc.data();
                if (!slotData || slotData.status !== 'available') {
                    console.warn(`⚠️ Slot ${slot.slotId} is not available (status: ${slotData?.status})`);
                    return NextResponse.json({ error: `Créneau non disponible: ${slot.slotId}` }, { status: 400 });
                }

                availableSlots.push({ 
                  ref: slotRef, 
                  data: slotData,
                  participant: slot.participant 
                });
                console.log(`✅ Slot ${slot.slotId} validated for checkout`);

            } catch (slotError) {
                console.error(`❌ Error validating slot ${slot.slotId}:`, slotError);
                return NextResponse.json({ error: `Erreur lors de la vérification du créneau: ${slot.slotId}` }, { status: 500 });
            }
        }

        console.log(`📊 Creating Stripe session with total amount: ${totalAmount}€`);

        const origin = req.headers.get('origin') || 'http://localhost:3000';

        // 2️⃣ Création de la Session Stripe avec le montant total
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: `Réservation - ${slotsToReserve.length} créneau(x)`,
                            description: `Réservation de ${slotsToReserve.length} créneau(x) de compétition`,
                        },
                        unit_amount: Math.round(totalAmount * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/${lang}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/${lang}/booking?canceled=true`,
            
            metadata: {
                userId: userId,
                userEmail: userEmail,
                eventId: eventId || '',
                slotsToReserve: JSON.stringify(slotsToReserve.map((s: SlotWithParticipant) => ({
                  slotId: s.slotId,
                  participant: s.participant
                }))),
                isPack: 'false',
            },
        });

        console.log(`✅ Stripe session created: ${session.id}`);

        // 3️⃣ Marquer les slots comme 'locked' avec les infos du participant
        const batch = adminDB.batch();
        const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        
        availableSlots.forEach(({ ref, participant }) => {
            batch.update(ref, {
                status: 'locked',
                lockedByUserId: userId,
                lockedUntil: admin.firestore.Timestamp.fromDate(lockedUntil),
                stripeSessionId: session.id,
                participant: participant || null,
                buyerId: userId,
            });
        });
        await batch.commit();

        console.log(`✅ ${availableSlots.length} slots marked as locked for 10 minutes`);

        return NextResponse.json({ sessionId: session.id, url: session.url });

    } catch (error) {
        console.error("❌ Erreur lors de la création de la session Stripe:", error);
        
        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
            return NextResponse.json({ 
                error: `Erreur Stripe: ${error.message}`,
                details: error.param 
            }, { status: 400 });
        }
        
        return NextResponse.json({ 
            error: "Erreur interne du serveur lors de la création de la session Stripe." 
        }, { status: 500 });
    }
}
