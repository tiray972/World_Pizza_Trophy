// Appels aux routes d'administration : le serveur vérifie le rôle à chaque appel.
import { getAuth } from "firebase/auth";

export class AdminRequestError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) {
    super(message);
  }
}

export async function adminFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const user = getAuth().currentUser;
  if (!user) throw new AdminRequestError(401, "Connectez-vous avec un compte administrateur.");
  const response = await fetch(path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AdminRequestError(response.status, data.error || `Erreur ${response.status}`, data.code, data.details);
  }
  return data as T;
}

/** Identifiant de requête pour les créations idempotentes (double clic). */
export function newRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
