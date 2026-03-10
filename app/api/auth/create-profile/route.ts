import { NextRequest, NextResponse } from 'next/server';
import { adminDB } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { uid, email, firstName, lastName, phone, country } = await req.json();

    console.log(`📍 [create-profile] Received request:`, { uid, email, firstName, lastName });

    if (!uid || !email) {
      console.error('❌ Missing uid or email');
      return NextResponse.json(
        { error: 'UID and email are required' },
        { status: 400 }
      );
    }

    // Vérifier si le profil existe déjà
    const userRef = adminDB.collection('users').doc(uid);
    
    try {
      const userSnap = await userRef.get();
      
      // Vérifier si le document existe
      if (userSnap && userSnap.exists && userSnap.exists()) {
        console.log(`⚠️ User profile already exists: ${uid}`);
        return NextResponse.json({ message: 'Profile already exists' }, { status: 200 });
      }
    } catch (checkError) {
      console.log(`ℹ️ First time user or document check inconclusive, proceeding to create`);
    }

    // Créer le profil utilisateur avec le rôle 'user'
    const userProfile = {
      id: uid,
      firstName: firstName || 'User',
      lastName: lastName || '',
      email: email,
      phone: phone || '',
      country: country || '',
      role: 'user',
      registrations: {},
      createdAt: admin.firestore.Timestamp.fromDate(new Date()),
    };

    console.log(`📝 [create-profile] Setting user profile for ${uid}`);

    await userRef.set(userProfile);

    console.log(`✅ [create-profile] User profile created: ${uid} with role 'user'`);

    return NextResponse.json(
      { message: 'Profile created successfully', userId: uid },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('❌ [create-profile] Error creating user profile:', error.message || error);
    return NextResponse.json(
      { error: 'Error creating profile', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
