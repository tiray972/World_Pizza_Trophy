import { NextRequest, NextResponse } from 'next/server';
import { adminDB } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

const LOCK_DURATION_MINUTES = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slotIds, userId } = body;

    if (!slotIds || slotIds.length === 0 || !userId) {
      return NextResponse.json(
        { error: 'slotIds and userId are required' },
        { status: 400 }
      );
    }

    console.log(`🔒 [lock-slots] Locking ${slotIds.length} slots for user ${userId}`);

    const batch = adminDB.batch();
    const lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);

    for (const slotId of slotIds) {
      const slotRef = adminDB.collection('slots').doc(slotId);
      batch.update(slotRef, {
        status: 'locked',
        lockedByUserId: userId,
        lockedUntil: admin.firestore.Timestamp.fromDate(lockedUntil),
      });
    }

    await batch.commit();

    console.log(`✅ [lock-slots] ${slotIds.length} slots locked until ${lockedUntil.toISOString()}`);

    return NextResponse.json(
      { message: 'Slots locked successfully', lockedUntil },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ [lock-slots] Error locking slots:', error.message);
    return NextResponse.json(
      { error: 'Error locking slots', details: error.message },
      { status: 500 }
    );
  }
}
