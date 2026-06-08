import { NextResponse, NextRequest } from "next/server";
import { adminDB } from "@/lib/firebase/admin";
import Stripe from 'stripe';
import * as admin from "firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
});

interface SlotWithParticipant {
  slotId: string;
  categoryId: string;
  participant?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    shirtSize?: string;
  };
}

interface MealGuest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isParticipant?: boolean;
}

interface CheckoutBody {
  slotsToReserve: SlotWithParticipant[];
  userId: string;
  userEmail: string;
  eventId: string;
  totalAmount: number;
  includeMeal: boolean;
  mealPrice: number;
  mealGuests?: MealGuest[];
  lang: string;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as CheckoutBody;
        const { slotsToReserve, userId, userEmail, eventId, totalAmount, includeMeal, mealPrice, mealGuests = [], lang } = body;

        if (!slotsToReserve || !userId || !userEmail || !totalAmount || !lang) {
            return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
        }

        const missingShirtSize = slotsToReserve.some(slot => !slot.participant?.shirtSize);
        if (missingShirtSize) {
            return NextResponse.json({ error: "La taille du t-shirt est obligatoire pour chaque participant." }, { status: 400 });
        }

        const cleanedMealGuests = includeMeal
            ? mealGuests
                .map(guest => ({
                    firstName: guest.firstName?.trim(),
                    lastName: guest.lastName?.trim(),
                    email: guest.email?.trim() || undefined,
                    phone: guest.phone?.trim() || undefined,
                    isParticipant: !!guest.isParticipant,
                }))
                .filter(guest => guest.firstName && guest.lastName)
            : [];
        const mealQuantity = cleanedMealGuests.length;

        if (slotsToReserve.length === 0 && mealQuantity === 0) {
            return NextResponse.json({ error: "Ajoutez au moins un créneau ou un repas." }, { status: 400 });
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
        // Calculer le coût des slots (totalAmount - mealPrice si repas inclus)
        const slotsCost = includeMeal && mealPrice > 0 ? totalAmount - (mealPrice * mealQuantity) : totalAmount;
        
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

        if (slotsToReserve.length > 0 && slotsCost > 0) {
            lineItems.push({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: `Créneaux de Compétition - ${slotsToReserve.length} créneau(x)`,
                        description: `Réservation de ${slotsToReserve.length} créneau(x) de compétition`,
                    },
                    unit_amount: Math.round(slotsCost * 100),
                },
                quantity: 1,
            });
        }

        // Ajouter le line item du repas s'il est inclus
        if (includeMeal && mealPrice > 0 && mealQuantity > 0) {
            lineItems.push({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Repas',
                        description: `Repas pendant l'événement pour ${mealQuantity} personne(s)`,
                    },
                    unit_amount: Math.round(mealPrice * 100),
                },
                quantity: mealQuantity,
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
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
                includeMeal: includeMeal ? 'true' : 'false',
                mealPrice: mealPrice.toString(),
                mealQuantity: mealQuantity.toString(),
                mealGuests: JSON.stringify(cleanedMealGuests),
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
        if (availableSlots.length > 0) {
            await batch.commit();
        }

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
