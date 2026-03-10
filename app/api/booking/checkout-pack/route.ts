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

interface PackCheckoutBody {
  slotsToReserve: SlotWithParticipant[];
  userId: string;
  userEmail: string;
  eventId: string;
  packId: string;
  packName: string;
  totalAmount: number;
  lang: string;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as PackCheckoutBody;
        const { slotsToReserve, userId, userEmail, eventId, packId, packName, totalAmount, lang } = body;

        // ✅ Validation complète des données
        if (!slotsToReserve || slotsToReserve.length === 0) {
            return NextResponse.json({ error: "Aucun créneau sélectionné dans le pack." }, { status: 400 });
        }
        if (!userId || !userEmail) {
            return NextResponse.json({ error: "Données utilisateur manquantes." }, { status: 400 });
        }
        if (!totalAmount || totalAmount <= 0) {
            return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
        }
        if (!packId || !packName) {
            return NextResponse.json({ error: "Données du pack manquantes." }, { status: 400 });
        }
        if (!lang) {
            return NextResponse.json({ error: "Langue manquante." }, { status: 400 });
        }

        console.log(`🔵 [Pack Checkout] Starting pack checkout for user ${userId}, pack ${packId}, slots: ${slotsToReserve.length}, total: ${totalAmount}€`);

        const availableSlots = [];
        
        // 1️⃣ Vérification de la disponibilité des slots et verrouillage
        for (const slot of slotsToReserve) {
            try {
                const slotRef = adminDB.collection("slots").doc(slot.slotId);
                const slotDoc = await slotRef.get();

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
                console.log(`✅ Slot ${slot.slotId} validated for pack checkout`);

            } catch (slotError) {
                console.error(`❌ Error validating slot ${slot.slotId}:`, slotError);
                return NextResponse.json({ error: `Erreur lors de la vérification du créneau: ${slot.slotId}` }, { status: 500 });
            }
        }

        console.log(`📊 Creating Stripe session for pack with total amount: ${totalAmount}€`);

        const origin = req.headers.get('origin') || 'http://localhost:3000';

        // 2️⃣ Création de la Session Stripe avec price_data dynamique (COMME LE MULTI-SLOTS)
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: `Pack - ${packName}`,
                            description: `Pack de ${slotsToReserve.length} créneau(x) de compétition`,
                        },
                        unit_amount: Math.round(totalAmount * 100), // ✅ Montant calculé dynamiquement
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
                packId: packId,
                packName: packName,
                slotsToReserve: JSON.stringify(slotsToReserve.map((s: SlotWithParticipant) => ({
                    slotId: s.slotId,
                    participant: s.participant
                }))),
                isPack: 'true', // ✅ Marquer comme pack
            },
        });

        console.log(`✅ Stripe session created for pack: ${session.id}`);

        // 3️⃣ Marquer les slots comme 'locked' avec les MÊMES RÈGLES que multi-slots
        const batch = adminDB.batch();
        const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes (IDENTIQUE)
        
        availableSlots.forEach(({ ref, participant }) => {
            batch.update(ref, {
                status: 'locked', // ✅ MÊME STATUS que multi-slots
                lockedByUserId: userId,
                lockedUntil: admin.firestore.Timestamp.fromDate(lockedUntil),
                stripeSessionId: session.id,
                participant: participant || null, // ✅ Participant géré COMME multi-slots
                buyerId: userId, // ✅ Buyer ID SET
                packId: packId, // ✅ Tracer le pack source
            });
        });
        await batch.commit();

        console.log(`✅ ${availableSlots.length} slots marked as locked for 10 minutes (pack)`);

        return NextResponse.json({ sessionId: session.id, url: session.url });

    } catch (error) {
        console.error("❌ Erreur lors de la création de la session Stripe (Pack):", error);
        
        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
            console.error(`Stripe Error Details:`, {
                message: error.message,
                param: error.param,
                code: error.code,
            });
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
