"use client";

// Accès au dashboard : compte connecté ET administrateur. Ce garde n'est qu'un
// confort d'affichage — la vraie protection est côté serveur (routes admin) et
// dans les règles Firestore.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/providers/AuthProvider";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([user.getIdTokenResult(), getDoc(doc(db, "users", user.uid)).catch(() => null)])
      .then(([token, profile]) => {
        if (!cancelled) setIsAdmin(token.claims.role === "admin" || profile?.data()?.role === "admin");
      })
      .catch(() => !cancelled && setIsAdmin(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || (user && isAdmin === null)) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Vérification de l&apos;accès…</div>;
  }
  if (!user || !isAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-semibold">Accès réservé aux administrateurs</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {user ? "Ce compte n'a pas les droits d'administration." : "Connectez-vous avec un compte administrateur pour ouvrir le tableau de bord."}
        </p>
        {!user && (
          <Link className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href="/fr/auth/login?redirect=/dashboard">
            Se connecter
          </Link>
        )}
      </div>
    );
  }
  return <>{children}</>;
}
