// Accès à l'émulateur Firestore pour les tests (jamais à la production :
// le projet « demo-* » n'existe que dans l'émulateur).
import { initializeApp, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export const TEST_PROJECT_ID = "demo-wpt";

export function emulatorHost(): string {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) {
    throw new Error("FIRESTORE_EMULATOR_HOST absent : lancez les tests avec `npm test` (émulateur).");
  }
  return host;
}

let app: App | undefined;

export function testDb(): Firestore {
  emulatorHost();
  app = app ?? getApps().find(existing => existing.name === "tests") ?? initializeApp({ projectId: TEST_PROJECT_ID }, "tests");
  return getFirestore(app);
}

/** Vide toute la base de l'émulateur entre deux tests. */
export async function resetDb(): Promise<void> {
  const response = await fetch(
    `http://${emulatorHost()}/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" }
  );
  if (!response.ok) throw new Error(`Réinitialisation de l'émulateur impossible : ${response.status}`);
}
