import { NextResponse, NextRequest } from "next/server";
import { adminDB } from "@/lib/firebase/admin";
import Stripe from 'stripe';
import * as admin from "firebase-admin";
import {
    attachSessionToPendingBooking,
    buildBookingMetadata,
    createPendingBooking,
    deletePendingBooking,
    type BookingMealGuest,
    type BookingSlot,
} from "@/lib/booking/pending-booking";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
});

type SlotWithParticipant = BookingSlot & { categoryId: string };
type MealGuest = BookingMealGuest;

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
    let pendingBookingRef: string | null = null;

    try {
        const body = await req.json() as CheckoutBody;
        const { slotsToReserve = [], userId, userEmail, eventId, totalAmount, includeMeal, mealPrice, mealGuests = [], lang } = body;

        if (!Array.isArray(slotsToReserve) || !userId || !userEmail || !totalAmount || !lang) {
            return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
        }

        // ✅ Un même créneau ne peut pas être réservé deux fois dans le même panier
        const uniqueSlotIds = new Set(slotsToReserve.map(slot => slot.slotId));
        if (uniqueSlotIds.size !== slotsToReserve.length) {
            return NextResponse.json({ error: "Un créneau est sélectionné plusieurs fois." }, { status: 400 });
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
                .filter(guest => guest.firstName && guest.lastName) as MealGuest[]
            : [];
        const mealQuantity = cleanedMealGuests.length;

        if (slotsToReserve.length === 0 && mealQuantity === 0) {
            return NextResponse.json({ error: "Ajoutez au moins un créneau ou un repas." }, { status: 400 });
        }

        console.log(`🔵 [Checkout] Starting checkout for user ${userId}, event ${eventId}, slots: ${slotsToReserve.length}, meals: ${mealQuantity}, total: ${totalAmount}€`);

        const availableSlots = [];
        const now = new Date();

        // 1️⃣ Vérification de la disponibilité des slots
        for (const slot of slotsToReserve) {
            try {
                const slotRef = adminDB.collection("slots").doc(slot.slotId);
                const slotDoc = await slotRef.get();

                if (!slotDoc || !slotDoc.exists) {
                    console.error(`❌ Slot ${slot.slotId} does not exist`);
                    return NextResponse.json({ error: `Créneau inexistant: ${slot.slotId}` }, { status: 400 });
                }

                const slotData = slotDoc.data();
                if (!slotData || !isSlotReservableBy(slotData, userId, now)) {
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
        // Calculer le coût des slots (totalAmount - repas)
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

        if (lineItems.length === 0) {
            return NextResponse.json({ error: "Montant à payer invalide." }, { status: 400 });
        }

        // 3️⃣ Sauvegarder la charge utile hors des metadata Stripe (limite 500 caractères)
        const payload = {
            userId,
            userEmail,
            eventId: eventId || '',
            isPack: false,
            totalAmount,
            includeMeal: !!includeMeal,
            mealPrice: mealPrice || 0,
            mealQuantity,
            slots: slotsToReserve.map(slot => ({
                slotId: slot.slotId,
                categoryId: slot.categoryId,
                participant: slot.participant,
            })),
            mealGuests: cleanedMealGuests,
        };
        pendingBookingRef = await createPendingBooking(payload);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${origin}/${lang}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/${lang}/booking?canceled=true`,
            metadata: buildBookingMetadata(payload, pendingBookingRef),
        });

        await attachSessionToPendingBooking(pendingBookingRef, session.id);

        console.log(`✅ Stripe session created: ${session.id}`);

        // 4️⃣ Marquer les slots comme 'locked' avec les infos du participant
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

        if (pendingBookingRef) {
            await deletePendingBooking(pendingBookingRef);
        }

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

/**
 * Un créneau est réservable s'il est libre, si son verrou a expiré,
 * ou s'il est déjà verrouillé par l'utilisateur lui-même (abandon d'un
 * paiement précédent) — sinon l'utilisateur restait bloqué 10 minutes.
 */
function isSlotReservableBy(
    slotData: admin.firestore.DocumentData,
    userId: string,
    now: Date
): boolean {
    if (slotData.status === 'available') return true;
    if (slotData.status !== 'locked') return false;

    if (slotData.lockedByUserId === userId) return true;

    const lockedUntil = slotData.lockedUntil?.toDate?.() ?? (slotData.lockedUntil ? new Date(slotData.lockedUntil) : null);
    return !!lockedUntil && lockedUntil < now;
}
