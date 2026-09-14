"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<string, { title: string; body: string; retry: string; home: string }> = {
  fr: {
    title: "Une erreur est survenue",
    body: "La page n'a pas pu s'afficher correctement. Réessayez : si le problème persiste, désactivez la traduction automatique de votre navigateur pour ce site, puis rechargez la page.",
    retry: "Réessayer",
    home: "Retour à l'accueil",
  },
  en: {
    title: "Something went wrong",
    body: "This page could not be displayed. Please try again: if the problem persists, turn off your browser's automatic translation for this site and reload the page.",
    retry: "Try again",
    home: "Back to home",
  },
  es: {
    title: "Se ha producido un error",
    body: "La página no se ha podido mostrar. Inténtalo de nuevo: si el problema continúa, desactiva la traducción automática del navegador para este sitio y recarga la página.",
    retry: "Reintentar",
    home: "Volver al inicio",
  },
  it: {
    title: "Si è verificato un errore",
    body: "La pagina non è stata caricata correttamente. Riprova: se il problema persiste, disattiva la traduzione automatica del browser per questo sito e ricarica la pagina.",
    retry: "Riprova",
    home: "Torna alla home",
  },
};

export default function LocalizedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Remonte l'erreur dans la console du visiteur et dans les logs Vercel.
    console.error("❌ [ErrorBoundary]", error);
  }, [error]);

  const lang =
    typeof window !== "undefined" ? window.location.pathname.split("/")[1] || "fr" : "fr";
  const messages = MESSAGES[lang] || MESSAGES.fr;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
        <p className="text-5xl mb-4">🍕</p>
        <h1 className="text-2xl font-bold text-[#8B0000] mb-3">{messages.title}</h1>
        <p className="text-gray-600 leading-relaxed mb-6">{messages.body}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} className="bg-[#8B0000] hover:bg-[#A50000]">
            {messages.retry}
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = `/${lang}`)}>
            {messages.home}
          </Button>
        </div>

        {error.digest && (
          <p className="text-xs text-gray-400 mt-6">Référence : {error.digest}</p>
        )}
      </div>
    </div>
  );
}
