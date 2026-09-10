import { NextRequest, NextResponse } from 'next/server';
import { adminDB } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
});

export async function POST(req: NextRequest) {
  try {
    const now = new Date();

    console.log(`🔓 [unlock-expired-slots] Checking for expired locks at ${now.toISOString()}`);

    // Requête pour tous les slots verrouillés
    const query = adminDB.collection('slots').where('status', '==', 'locked');
    const snapshot = await query.get();

    // 1️⃣ Repérer les verrous expirés
    const expired: { ref: admin.firestore.DocumentReference; sessionId?: string }[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const lockedUntil = data.lockedUntil?.toDate?.() || new Date(data.lockedUntil);
      if (lockedUntil < now) {
        expired.push({ ref: doc.ref, sessionId: data.stripeSessionId || undefined });
      }
    });

    if (expired.length === 0) {
      console.log(`ℹ️ [unlock-expired-slots] No expired locks found`);
      return NextResponse.json({ message: '0 slots unlocked', unlockedCount: 0 }, { status: 200 });
    }

    // 2️⃣ ⚠️ Ne JAMAIS libérer un créneau déjà payé : si la session Stripe est
    // payée mais que l'enregistrement n'a pas eu lieu (onglet fermé avant la
    // page de succès, webhook absent), on répare au lieu de libérer la place.
    const paidSessions = new Set<string>();
    const sessionIds = Array.from(new Set(expired.map(slot => slot.sessionId).filter(Boolean) as string[]));

    for (const sessionId of sessionIds) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === 'paid') {
          paidSessions.add(sessionId);
          console.warn(`💰 [unlock-expired-slots] Session ${sessionId} PAYÉE mais non enregistrée — récupération en cours`);
        }
      } catch (stripeError) {
        // Session illisible : par prudence on ne libère pas le créneau.
        console.error(`⚠️ [unlock-expired-slots] Session ${sessionId} illisible:`, stripeError);
        paidSessions.add(sessionId);
      }
    }

    // 3️⃣ Rattraper les paiements manquants
    const origin = req.nextUrl.origin;
    const recovered: string[] = [];
    for (const sessionId of paidSessions) {
      try {
        const response = await fetch(`${origin}/api/booking/record-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        if (response.ok) {
          recovered.push(sessionId);
          console.log(`✅ [unlock-expired-slots] Paiement récupéré pour la session ${sessionId}`);
        }
      } catch (recoveryError) {
        console.error(`❌ [unlock-expired-slots] Récupération impossible pour ${sessionId}:`, recoveryError);
      }
    }

    // 4️⃣ Libérer uniquement les créneaux réellement abandonnés
    const batch = adminDB.batch();
    let unlockedCount = 0;

    for (const slot of expired) {
      if (slot.sessionId && paidSessions.has(slot.sessionId)) continue;

      console.log(`⏰ Slot ${slot.ref.id} lock expired, reverting to available`);
      batch.update(slot.ref, {
        status: 'available',
        lockedByUserId: admin.firestore.FieldValue.delete(),
        lockedUntil: admin.firestore.FieldValue.delete(),
        stripeSessionId: null,
        participant: admin.firestore.FieldValue.delete(),
        participants: admin.firestore.FieldValue.delete(),
        buyerId: admin.firestore.FieldValue.delete(),
      });
      unlockedCount++;
    }

    if (unlockedCount > 0) {
      await batch.commit();
      console.log(`✅ [unlock-expired-slots] ${unlockedCount} slots unlocked`);
    }

    return NextResponse.json(
      {
        message: `${unlockedCount} slots unlocked`,
        unlockedCount,
        recoveredPayments: recovered.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ [unlock-expired-slots] Error:', error.message);
    return NextResponse.json(
      { error: 'Error unlocking slots', details: error.message },
      { status: 500 }
    );
  }
}
