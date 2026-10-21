import { NextResponse, NextRequest } from "next/server";
import { adminDB } from "@/lib/firebase/admin";
import Stripe from 'stripe';
import * as admin from "firebase-admin";
import {
    attachSessionToPendingBooking,
    buildBookingMetadata,
    createPendingBooking,
    deletePendingBooking,
} from "@/lib/booking/pending-booking";
import { getParticipantsPerSlot, validateBookingSelection } from "@/lib/booking/rules";
import { createCheckoutSession } from "@/lib/booking/stripe-session";
import type { Category, Participant, Product } from "@/types/firestore";
import { clampPackQuantity, packAllowsCategory, packMealsIncluded, UNNAMED_PACK_MEAL } from "@/lib/booking/packs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
});

interface SlotWithParticipant {
  slotId: string;
  categoryId: string;
  participant?: Participant;
  participants?: Participant[];
}

interface PackCheckoutBody {
  slotsToReserve: SlotWithParticipant[];
  userId: string;
  userEmail: string;
  eventId: string;
  packId: string;
  packName: string;
  /** Ignoré : le prix est recalculé côté serveur depuis le produit. */
  totalAmount?: number;
  /** Nombre d'exemplaires du même pack (1 par défaut). */
  quantity?: number;
  /** Noms des repas inclus dans le pack. */
  mealGuests?: { firstName?: string; lastName?: string }[];
  lang: string;
}

export async function POST(req: NextRequest) {
    let pendingBookingRef: string | null = null;

    try {
        const body = await req.json() as PackCheckoutBody;
        const { slotsToReserve, userId, userEmail, eventId, packId, lang } = body;
        const quantity = clampPackQuantity(body.quantity ?? 1);

        // ✅ Validation complète des données
        if (!slotsToReserve || slotsToReserve.length === 0) {
            return NextResponse.json({ error: "Aucun créneau sélectionné dans le pack." }, { status: 400 });
        }
        if (!userId || !userEmail) {
            return NextResponse.json({ error: "Données utilisateur manquantes." }, { status: 400 });
        }
        if (!packId) {
            return NextResponse.json({ error: "Données du pack manquantes." }, { status: 400 });
        }
        if (!lang) {
            return NextResponse.json({ error: "Langue manquante." }, { status: 400 });
        }
        const uniqueSlotIds = new Set(slotsToReserve.map(slot => slot.slotId));
        if (uniqueSlotIds.size !== slotsToReserve.length) {
            return NextResponse.json({ error: "Un créneau est sélectionné plusieurs fois." }, { status: 400 });
        }


        // 🔒 Le produit fait foi : jamais le prix ni le contenu envoyés par le navigateur
        const productDoc = await adminDB.collection("products").doc(packId).get();
        const product = productDoc.exists ? ({ id: productDoc.id, ...productDoc.data() } as Product) : null;
        if (!product || !product.isActive || (eventId && product.eventId && product.eventId !== eventId)) {
            return NextResponse.json({ error: "Ce pack n'est plus disponible." }, { status: 400 });
        }
        const packName = product.name;
        const expectedSlots = (Number(product.slotsRequired) || 0) * quantity;
        if (slotsToReserve.length !== expectedSlots) {
            return NextResponse.json({
                error: `Ce pack demande ${expectedSlots} créneau(x) (${quantity} × ${product.slotsRequired}), ${slotsToReserve.length} sélectionné(s).`,
            }, { status: 400 });
        }
        const totalAmount = Math.round(Number(product.unitAmount) * quantity * 100) / 100;
        if (!totalAmount || totalAmount <= 0) {
            return NextResponse.json({ error: "Prix du pack invalide." }, { status: 400 });
        }

        console.log(`🔵 [Pack Checkout] Starting pack checkout for user ${userId}, pack ${packId} x${quantity}, slots: ${slotsToReserve.length}, total: ${totalAmount}€`);

        const availableSlots = [];
        const now = new Date();
        
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
                if (!slotData || !isSlotReservableBy(slotData, userId, now)) {
                    console.warn(`⚠️ Slot ${slot.slotId} is not available (status: ${slotData?.status})`);
                    return NextResponse.json({ error: `Créneau non disponible: ${slot.slotId}` }, { status: 400 });
                }

                availableSlots.push({
                    ref: slotRef,
                    data: slotData,
                    categoryId: (slotData.categoryId as string) || slot.categoryId,
                    participants: participantsOfPayload(slot),
                });
                console.log(`✅ Slot ${slot.slotId} validated for pack checkout`);

            } catch (slotError) {
                console.error(`❌ Error validating slot ${slot.slotId}:`, slotError);
                return NextResponse.json({ error: `Erreur lors de la vérification du créneau: ${slot.slotId}` }, { status: 500 });
            }
        }

        // 🚫 Catégories exclues de ce pack
        const excluded = availableSlots.filter(slot => !packAllowsCategory(product, slot.categoryId));
        if (excluded.length > 0) {
            return NextResponse.json({ error: "Une des catégories choisies n'est pas incluse dans ce pack." }, { status: 400 });
        }

        // 1️⃣bis Participants requis par catégorie (duo) — le minimum de créneaux
        // ne s'applique pas aux packs, qui imposent déjà leur nombre de créneaux.
        const categoryIds = Array.from(new Set(availableSlots.map(slot => slot.categoryId).filter(Boolean)));
        const categoryDocs = await Promise.all(
            categoryIds.map(categoryId => adminDB.collection("categories").doc(categoryId).get())
        );
        const participantsPerCategory: Record<string, number> = {};
        const categoryNames: Record<string, string> = {};
        categoryDocs.forEach((categoryDoc, index) => {
            const categoryId = categoryIds[index];
            const categoryData = categoryDoc.exists ? (categoryDoc.data() as Category) : undefined;
            participantsPerCategory[categoryId] = getParticipantsPerSlot(categoryData);
            categoryNames[categoryId] = categoryData?.name || "cette catégorie";
        });

        const ruleErrors = validateBookingSelection({
            slots: availableSlots.map(slot => ({
                slotId: slot.ref.id,
                categoryId: slot.categoryId,
                participants: slot.participants,
                startTime: slot.data.startTime?.toDate?.() ?? slot.data.startTime,
                endTime: slot.data.endTime?.toDate?.() ?? slot.data.endTime,
            })),
            participantsPerCategory,
            categoryNames,
            minSlots: 1,
        });

        if (ruleErrors.length > 0) {
            console.warn(`⚠️ [Pack Checkout] Règles non respectées:`, ruleErrors);
            return NextResponse.json({ error: ruleErrors.join(" ") }, { status: 400 });
        }

        // 🍽️ Repas inclus : nommés si possible, sinon comptés « à préciser »
        const mealQuantity = packMealsIncluded(product) * quantity;
        const namedMeals = (body.mealGuests ?? [])
            .map(guest => ({ firstName: guest.firstName?.trim() || "", lastName: guest.lastName?.trim() || "" }))
            .filter(guest => guest.firstName && guest.lastName)
            .slice(0, mealQuantity);
        const mealGuests = [
            ...namedMeals,
            ...Array.from({ length: mealQuantity - namedMeals.length }, () => ({ ...UNNAMED_PACK_MEAL })),
        ];
        console.log(`📊 Creating Stripe session for pack with total amount: ${totalAmount}€`);

        const origin = req.headers.get('origin') || 'http://localhost:3000';

        // 2️⃣ Sauvegarder la charge utile hors des metadata Stripe (limite 500 caractères)
        const payload = {
            userId,
            userEmail,
            eventId: eventId || '',
            isPack: true,
            packId,
            packName,
            totalAmount,
            includeMeal: mealQuantity > 0,
            mealPrice: 0, // repas compris dans le prix du pack
            mealQuantity,
            slots: slotsToReserve.map(slot => {
                const participants = participantsOfPayload(slot);
                return {
                    slotId: slot.slotId,
                    categoryId: slot.categoryId,
                    participant: participants[0],
                    participants,
                };
            }),
            mealGuests,
        };
        pendingBookingRef = await createPendingBooking(payload);

        // 3️⃣ Création de la Session Stripe avec price_data dynamique (COMME LE MULTI-SLOTS)
        const session = await createCheckoutSession({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: `Pack - ${packName}`,
                            description:
                                `${product.slotsRequired} créneau(x) de compétition` +
                                (packMealsIncluded(product) ? ` + ${packMealsIncluded(product)} repas` : ""),
                        },
                        unit_amount: Math.round(Number(product.unitAmount) * 100), // prix du produit en base
                    },
                    quantity,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/${lang}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/${lang}/booking?canceled=true`,
            
            metadata: buildBookingMetadata(payload, pendingBookingRef),
        });

        await attachSessionToPendingBooking(pendingBookingRef, session.id);

        console.log(`✅ Stripe session created for pack: ${session.id}`);

        // 3️⃣ Marquer les slots comme 'locked' avec les MÊMES RÈGLES que multi-slots
        const batch = adminDB.batch();
        const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes (IDENTIQUE)
        
        availableSlots.forEach(({ ref, participants }) => {
            batch.update(ref, {
                status: 'locked', // ✅ MÊME STATUS que multi-slots
                lockedByUserId: userId,
                lockedUntil: admin.firestore.Timestamp.fromDate(lockedUntil),
                stripeSessionId: session.id,
                participant: participants[0] || null, // ✅ Participant géré COMME multi-slots
                participants, // 👥 Duo : tous les participants du créneau
                buyerId: userId, // ✅ Buyer ID SET
                packId: packId, // ✅ Tracer le pack source
            });
        });
        await batch.commit();

        console.log(`✅ ${availableSlots.length} slots marked as locked for 10 minutes (pack)`);

        return NextResponse.json({ sessionId: session.id, url: session.url });

    } catch (error) {
        console.error("❌ Erreur lors de la création de la session Stripe (Pack):", error);

        if (pendingBookingRef) {
            await deletePendingBooking(pendingBookingRef);
        }
        
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

/**
 * Un créneau est réservable s'il est libre, si son verrou a expiré,
 * ou s'il est déjà verrouillé par l'utilisateur lui-même.
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

/** Participants transmis par le client, quel que soit le format (solo ou duo). */
function participantsOfPayload(slot: SlotWithParticipant): Participant[] {
    const list = Array.isArray(slot.participants) && slot.participants.length > 0
        ? slot.participants
        : slot.participant
            ? [slot.participant]
            : [];
    return list.filter(Boolean) as Participant[];
}
