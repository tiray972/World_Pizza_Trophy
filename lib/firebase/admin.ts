// lib/firebase/admin.ts
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_KEY!)),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE
  });
}

export const adminDB = admin.firestore();
export const adminAuth = admin.auth();
