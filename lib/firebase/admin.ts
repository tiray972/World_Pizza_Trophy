// lib/firebase-admin.ts - VERSION CORRIGÉE

import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Configuration de l'environnement
if (typeof window !== 'undefined') {
  throw new Error("This file should only be imported on the server side.");
}

let serviceAccountConfig: ServiceAccount;

// ============================================
// MÉTHODE 1 : Charger depuis le fichier JSON local (RECOMMANDÉ)
// ============================================
try {
  const serviceAccountPath = path.join(
    process.cwd(),
    'world-pizza-trophy-firebase-adminsdk-fbsvc-31972547bc.json'
  );

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
    const parsed = JSON.parse(serviceAccountJson);
    
    serviceAccountConfig = {
      projectId: parsed.project_id,
      privateKey: parsed.private_key,
      clientEmail: parsed.client_email,
    };
    
    console.log("✅ Firebase Admin initialisé avec fichier JSON local");
  } else {
    throw new Error("Service account file not found");
  }
} catch (err) {
  // ============================================
  // MÉTHODE 2 : Variables d'environnement séparées (FALLBACK)
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
  // MÉTHODE 3 : JSON complet en fallback
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
      "1. Place service account JSON in project root\n" +
      "2. FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL\n" +
      "3. FIREBASE_ADMIN_KEY (JSON complet)"
    );
  }
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