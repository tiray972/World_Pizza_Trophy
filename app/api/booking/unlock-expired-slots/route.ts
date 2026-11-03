import { NextRequest, NextResponse } from 'next/server';
import { adminDB } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import { finalizeAndNotify, stripeClient } from '@/lib/server/payments/stripe-adapter';

/** Réservations en attente examinées par appel (limite les appels Stripe). */
const PENDING_SCAN_LIMIT = 20;
/** Une réservation en attente plus ancienne n'a plus de session payable. */
const PENDING_EXPIRY_MS = 26 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const stripe = stripeClient();
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

    // 2️⃣ ⚠️ Ne JAMAIS libérer un créneau déjà payé : si la session Stripe est
    // payée mais que l'enregistrement n'a pas eu lieu (onglet fermé avant la
    // page de succès, webhook absent), on finalise au lieu de libérer la place.
    const keepLocked = new Set<string>();
    const recovered: string[] = [];
    const sessionIds = Array.from(new Set(expired.map(slot => slot.sessionId).filter(Boolean) as string[]));

    for (const sessionId of sessionIds) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === 'paid') {
          keepLocked.add(sessionId);
          console.warn(`💰 [unlock-expired-slots] Session ${sessionId} PAYÉE mais non enregistrée — récupération en cours`);
          const result = await finalizeAndNotify(adminDB, session, 'recovery');
          if (result.status === 'created') recovered.push(sessionId);
        }
      } catch (stripeError) {
        // Session illisible ou finalisation en échec : par prudence on ne libère pas le créneau.
        console.error(`⚠️ [unlock-expired-slots] Session ${sessionId} non traitée:`, stripeError);
        keepLocked.add(sessionId);
      }
    }

    // 3️⃣ Achats sans créneau (repas seuls) : aucun verrou ne les signale, on
    // examine donc aussi les réservations en attente.
    // ⚠️ Uniquement les réservations récentes au format actuel (`lockedUntil`
    // n'existe que depuis la finalisation unique) : les réservations
    // historiques ne sont jamais finalisées ni modifiées automatiquement — elles
    // relèvent du diagnostic validé. Filtre d'intervalle sur un seul champ :
    // aucun index composite requis ; le statut est filtré en mémoire.
    const recentSnapshot = await adminDB
      .collection('pendingBookings')
      .where('lockedUntil', '>=', admin.firestore.Timestamp.fromDate(new Date(now.getTime() - PENDING_EXPIRY_MS)))
      .get();
    const pendingDocs = recentSnapshot.docs
      .filter(doc => doc.data().status === 'pending')
      .slice(0, PENDING_SCAN_LIMIT);
    for (const pending of pendingDocs) {
      const data = pending.data();
      const sessionId = data.stripeSessionId as string | undefined;
      const createdAt: Date | null = data.createdAt?.toDate?.() ?? null;
      if (!sessionId || sessionIds.includes(sessionId)) continue;
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === 'paid') {
          const result = await finalizeAndNotify(adminDB, session, 'recovery');
          if (result.status === 'created') recovered.push(sessionId);
          // Déjà enregistrée (webhook ou page de succès) : on referme la réservation
          // pour qu'elle ne soit plus réexaminée.
          if (result.status === 'already_finalized') {
            await pending.ref.update({ status: 'paid', paymentId: result.paymentId, updatedAt: admin.firestore.Timestamp.now() });
          }
        } else if (session.status === 'expired' || (createdAt && now.getTime() - createdAt.getTime() > PENDING_EXPIRY_MS)) {
          await pending.ref.update({ status: 'expired', updatedAt: admin.firestore.Timestamp.now() });
        }
      } catch (pendingError) {
        console.error(`⚠️ [unlock-expired-slots] Réservation en attente ${pending.id} non traitée:`, pendingError);
      }
    }

    // 4️⃣ Libérer uniquement les créneaux réellement abandonnés
    const batch = adminDB.batch();
    let unlockedCount = 0;

    for (const slot of expired) {
      if (slot.sessionId && keepLocked.has(slot.sessionId)) continue;

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
