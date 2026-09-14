"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("❌ [GlobalError]", error);

  return (
    <html lang="fr" translate="no">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f9fafb",
          padding: "1rem",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <p style={{ fontSize: 48, margin: 0 }}>🍕</p>
          <h1 style={{ color: "#8B0000", fontSize: 22 }}>Une erreur est survenue</h1>
          <p style={{ color: "#4b5563", lineHeight: 1.6 }}>
            La page n'a pas pu s'afficher. Réessayez ; si le problème persiste, désactivez la
            traduction automatique de votre navigateur pour ce site.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              background: "#8B0000",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
          {error.digest && (
            <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 20 }}>
              Référence : {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
