import { NextRequest, NextResponse } from 'next/server';
import { adminDB } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const now = new Date();
    
    console.log(`🔓 [unlock-expired-slots] Checking for expired locks at ${now.toISOString()}`);

    // Requête pour tous les slots verrouillés
    const query = adminDB.collection('slots').where('status', '==', 'locked');
    const snapshot = await query.get();

    let unlockedCount = 0;
    const batch = adminDB.batch();

    snapshot.forEach(doc => {
      const data = doc.data();
      const lockedUntil = data.lockedUntil?.toDate?.() || new Date(data.lockedUntil);

      // Si le verrou a expiré
      if (lockedUntil < now) {
        console.log(`⏰ Slot ${doc.id} lock expired, reverting to available`);
        batch.update(doc.ref, {
          status: 'available',
          lockedByUserId: admin.firestore.FieldValue.delete(),
          lockedUntil: admin.firestore.FieldValue.delete(),
          stripeSessionId: null,
          participant: admin.firestore.FieldValue.delete(),
          buyerId: admin.firestore.FieldValue.delete(),
        });
        unlockedCount++;
      }
    });

    if (unlockedCount > 0) {
      await batch.commit();
      console.log(`✅ [unlock-expired-slots] ${unlockedCount} slots unlocked`);
    } else {
      console.log(`ℹ️ [unlock-expired-slots] No expired locks found`);
    }

    return NextResponse.json(
      { message: `${unlockedCount} slots unlocked`, unlockedCount },
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
