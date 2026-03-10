import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDB } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import { Payment } from '@/types/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as any,
});

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // 1️⃣ Récupérer la session Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    // 2️⃣ Extraire les métadonnées
    const {
      userId,
      userEmail,
      eventId,
      slotsToReserve: slotsToReserveJson,
      isPack: isPackString,
      packName,
      packId,
    } = session.metadata as {
      userId: string;
      userEmail: string;
      eventId: string;
      slotsToReserve: string;
      isPack: string;
      packName?: string;
      packId?: string;
    };

    if (!userId || !slotsToReserveJson) {
      console.error('❌ Missing metadata in session:', session.metadata);
      return NextResponse.json(
        { error: 'Missing metadata in payment session' },
        { status: 400 }
      );
    }

    // 3️⃣ Parser les slots
    let slotsData: Array<{ slotId: string; participant?: any }> = [];
    try {
      slotsData = JSON.parse(slotsToReserveJson);
      if (!Array.isArray(slotsData) || slotsData.length === 0) {
        throw new Error('slotsToReserve is invalid or empty');
      }
    } catch (e) {
      console.error('❌ Failed to parse slotsToReserve:', slotsToReserveJson, e);
      return NextResponse.json(
        { error: 'Invalid slot data in metadata' },
        { status: 400 }
      );
    }

    const isPack = isPackString === 'true';
    const amountTotal = session.amount_total || 0;

    // 4️⃣ Vérifier si le paiement existe déjà
    const existingPaymentQuery = await adminDB
      .collection('payments')
      .where('stripeSessionId', '==', sessionId)
      .limit(1)
      .get();

    if (!existingPaymentQuery.empty) {
      console.log(`⚠️ Payment already recorded for session ${sessionId}`);
      return NextResponse.json({
        success: true,
        message: 'Payment already recorded',
        paymentId: existingPaymentQuery.docs[0].id,
      });
    }

    // 5️⃣ Commencer une transaction batch
    const batch = adminDB.batch();

    // 6️⃣ Créer l'enregistrement de paiement
    const slotIds = slotsData.map((s: any) => s.slotId);
    const paymentRecord: Payment = {
      id: session.id,
      eventId: eventId || '',
      userId: userId,
      stripeSessionId: session.id,
      amount: amountTotal / 100,
      status: 'paid',
      source: 'stripe',
      slotIds: slotIds,
      isPack: isPack,
      packName: isPack ? packName : undefined,
      packId: isPack ? packId : undefined,
      metadata: session.metadata as Record<string, any>,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const paymentRef = adminDB.collection('payments').doc();
    // ✅ Filter out undefined values to avoid Firestore errors
    const paymentToSave = Object.fromEntries(
      Object.entries({
        ...paymentRecord,
        createdAt: admin.firestore.Timestamp.fromDate(paymentRecord.createdAt),
        updatedAt: admin.firestore.Timestamp.fromDate(paymentRecord.updatedAt),
      }).filter(([, value]) => value !== undefined)
    );
    batch.set(paymentRef, paymentToSave);

    console.log(`✅ Payment record created: ${paymentRef.id} for user ${userId}`);

    // 7️⃣ Mettre à jour les slots : locked -> paid
    const categoryIds = new Set<string>();
    for (const slotInfo of slotsData) {
      const slotId = slotInfo.slotId;
      const participant = slotInfo.participant;

      const slotRef = adminDB.collection('slots').doc(slotId);
      const slotDoc = await slotRef.get();

      if (slotDoc.exists) {
        const slotData = slotDoc.data();
        categoryIds.add(slotData?.categoryId || '');

        // Mettre à jour le slot : locked -> paid
        batch.update(slotRef, {
          buyerId: userId,
          status: 'paid',
          participant: participant || null,
          stripeSessionId: session.id,
          assignmentType: 'payment',
          paidAt: admin.firestore.Timestamp.fromDate(new Date()),
        });
      }
    }

    console.log(`✅ ${slotIds.length} slots updated to 'paid' status`);

    // 8️⃣ Mettre à jour l'utilisateur avec la structure EventRegistration
    const userRef = adminDB.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      if (!userData) {
        console.warn(`⚠️ User document data is empty: ${userId}`);
      } else {
        const registrations = userData.registrations || {};

        // Créer ou mettre à jour l'enregistrement pour cet événement
        if (!registrations[eventId]) {
          const newRegistration = {
            paid: true,
            categoryIds: Array.from(categoryIds).filter((id) => id),
            stripeCustomerId: session.customer,
            paymentId: paymentRef.id,
            registeredAt: admin.firestore.Timestamp.fromDate(new Date()),
          };
          // ✅ Filter out undefined values
          registrations[eventId] = Object.fromEntries(
            Object.entries(newRegistration).filter(([, value]) => value !== undefined)
          );
        } else {
          // Merger avec les catégories existantes
          const existingCategoryIds = registrations[eventId].categoryIds || [];
          const allCategoryIds = Array.from(
            new Set([...existingCategoryIds, ...Array.from(categoryIds).filter((id) => id)])
          );

          const updatedRegistration = {
            ...registrations[eventId],
            paid: true,
            categoryIds: allCategoryIds,
            stripeCustomerId: session.customer,
            paymentId: paymentRef.id,
            registeredAt: registrations[eventId].registeredAt || admin.firestore.Timestamp.fromDate(new Date()),
          };
          // ✅ Filter out undefined values
          registrations[eventId] = Object.fromEntries(
            Object.entries(updatedRegistration).filter(([, value]) => value !== undefined)
          );
        }

        batch.update(userRef, { registrations });
        console.log(`✅ User ${userId} registrations updated for event ${eventId}`);
      }
    } else {
      console.warn(`⚠️ User document not found: ${userId}`);
    }

    // Exécuter le batch
    await batch.commit();
    console.log(`✅ Payment processing COMPLETED for session ${session.id}`);

    return NextResponse.json({
      success: true,
      paymentId: paymentRef.id,
      amount: amountTotal / 100,
      slotsCount: slotIds.length,
    });
  } catch (error) {
    console.error('❌ Error recording payment:', error);
    return NextResponse.json(
      { error: 'Error recording payment' },
      { status: 500 }
    );
  }
}
