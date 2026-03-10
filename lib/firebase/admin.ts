// lib/firebase-admin.ts - VERSION CORRIGÉE

import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';

// Configuration de l'environnement
if (typeof window !== 'undefined') {
  throw new Error("This file should only be imported on the server side.");
}

// Configuration de l'environnement
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Handle both literal \n (from Vercel/env files) and pre-converted newlines
const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY ?? '';
const privateKey = privateKeyRaw.includes('\\n')
  ? privateKeyRaw.replace(/\\n/g, '\n')
  : privateKeyRaw;

if (!projectId || !clientEmail || !privateKey) {
  throw new Error(
    "Firebase Admin configuration missing. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables."
  );
}

const serviceAccountConfig: ServiceAccount = {
  projectId,
  clientEmail,
  privateKey,
};

// Initialisation de Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountConfig),
  });
}

export const adminDB = admin.firestore();
export const adminAuth = admin.auth();
export default admin;