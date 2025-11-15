import localFont from "next/font/local";
import "../globals.css";
import { locales } from "@/lib/i18n/config";
import { TriggerRefreshProvider } from "@/providers/TriggerRefreshprovider";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const francois = localFont({
  src: "../../fonts/FrancoisOne-Regular.ttf",
  variable: "--font-francois-sans",
  weight: "100 900",
});

// 🏆 Nouveau nom officiel
export const metadata = {
  title: "Trophée Mondial de la Pizza Multicatégorie",
  description:
    "Participez au Trophée Mondial de la Pizza Multicatégorie : un concours international pour pizzaiolos professionnels, avec inscriptions, catégories, créneaux de passage et classement officiel.",
};

export async function generateStaticParams() {
  return locales.map((lang) => ({
    lang,
  }));
}

export default async function RootLayout({ children, params }) {
  const { lang } = await params;
  // const dictionary = await getDictionary(lang);

  return (
    <html lang={lang}>
      <head>
        {/* Manifest • PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />

        {/* Meta Description */}
        <meta
          name="description"
          content="Participez au Trophée Mondial de la Pizza Multicatégorie : un concours international pour pizzaiolos professionnels, avec inscriptions, catégories, créneaux de passage et classement officiel."
        />

        {/* Open Graph */}
        <meta
          property="og:title"
          content="Trophée Mondial de la Pizza Multicatégorie"
        />
        <meta
          property="og:description"
          content="Concours international de pizzaiolos : réservation, inscription, paiement en ligne et sélection multicatégorie."
        />
        <meta property="og:image" content="/images/logo.png" />
        <meta
          property="og:url"
          content="https://www.world-pizza-trophy.com"
        />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content={lang === "fr" ? "fr_FR" : "en_US"} />

        {/* Twitter / X */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Trophée Mondial de la Pizza Multicatégorie"
        />
        <meta
          name="twitter:description"
          content="Inscrivez-vous au concours international professionnel de la pizza. Réservation des créneaux et participation officielle."
        />
        <meta name="twitter:image" content="/images/logo.png" />
        <meta name="twitter:site" content="@worldpizzatrophy" />
      </head>

      <body
        suppressHydrationWarning
        className={`${francois.variable} antialiased`}
      >
        <TriggerRefreshProvider>{children}</TriggerRefreshProvider>
      </body>
    </html>
  );
}
