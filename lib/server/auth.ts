// lib/server/auth.ts
// Contrôles d'accès des routes serveur. Le dashboard n'est qu'une interface :
// toute action sensible est vérifiée ici, à partir du jeton Firebase.

import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export interface Actor {
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

function bearerToken(headers: Headers): string | null {
  const authorization = headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
}

export async function requireUser(
  headers: Headers,
  deps: { auth: Auth; db: Firestore }
): Promise<Actor> {
  const token = bearerToken(headers);
  if (!token) throw new HttpError(401, "Authentification requise.", "auth/missing");

  let decoded: DecodedIdToken;
  try {
    decoded = await deps.auth.verifyIdToken(token);
  } catch {
    throw new HttpError(401, "Session expirée, reconnectez-vous.", "auth/expired");
  }

  const profile = (await deps.db.collection("users").doc(decoded.uid).get()).data();
  const isAdmin = decoded.role === "admin" || profile?.role === "admin";
  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || decoded.email || decoded.uid;

  return { uid: decoded.uid, email: decoded.email || profile?.email || "", displayName, isAdmin };
}

export async function requireAdmin(
  headers: Headers,
  deps: { auth: Auth; db: Firestore }
): Promise<Actor> {
  const actor = await requireUser(headers, deps);
  if (!actor.isAdmin) throw new HttpError(403, "Réservé aux administrateurs.", "auth/forbidden");
  return actor;
}

/** Réponse JSON homogène pour les erreurs de route. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("❌ Erreur serveur:", error);
  return Response.json({ error: "Erreur interne du serveur." }, { status: 500 });
}
