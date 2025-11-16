// lib/firebase-admin.ts - VERSION CORRIGÉE

import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';

// Configuration de l'environnement
if (typeof window !== 'undefined') {
  throw new Error("This file should only be imported on the server side.");
}

let serviceAccountConfig: ServiceAccount;

// ============================================
// MÉTHODE 1 : Variables d'environnement séparées (RECOMMANDÉ)
// ============================================
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  serviceAccountConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    // Remplace les \\n littéraux par de vrais retours à la ligne
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };
  
  console.log("✅ Firebase Admin initialisé avec variables séparées");
}
// ============================================
// MÉTHODE 2 : JSON complet en fallback
// ============================================
else if (process.env.FIREBASE_ADMIN_KEY) {
  try {
    const parsed = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
    serviceAccountConfig = {
      projectId: parsed.project_id,
      privateKey: parsed.private_key,
      clientEmail: parsed.client_email,
    };
    
    console.log("✅ Firebase Admin initialisé avec JSON complet");
  } catch (error) {
    console.error("❌ Erreur de parsing FIREBASE_ADMIN_KEY");
    throw new Error("Invalid FIREBASE_ADMIN_KEY format");
  }
}
// ============================================
// Aucune config trouvée
// ============================================
else {
  throw new Error(
    "Firebase Admin configuration missing. Set either:\n" +
    "1. FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL\n" +
    "2. FIREBASE_ADMIN_KEY (JSON complet)"
  );
}

// Initialisation de Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountConfig),
  });
}

export const adminDB = admin.firestore();
export const adminAuth = admin.auth();
export default admin;