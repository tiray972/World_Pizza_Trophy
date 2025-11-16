import localFont from "next/font/local";
import "../globals.css";
import { locales } from "@/lib/i18n/config";
import { TriggerRefreshProvider } from "@/providers/TriggerRefreshprovider";

const francois = localFont({
  src: "../../fonts/FrancoisOne-Regular.ttf",
  variable: "--font-francois-sans",
  weight: "100 900",
});

// Metadata
export const metadata = {
  title: "Trophée Mondial de la Pizza Multicatégorie",
  description:
    "Participez au Trophée Mondial de la Pizza Multicatégorie : concours international, réservations, catégories & passage en live scoring.",
};

// Static params for i18n
export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

// Type definition - params is now a Promise in Next.js 15
type RootLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
};

export default async function RootLayout({ children, params }: RootLayoutProps) {
  // Unwrap params promise
  const { lang } = await params;

  return (
    <html lang={lang}>
      <head>
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />

        {/* SEO */}
        <meta
          name="description"
          content="Participez au Trophée Mondial de la Pizza Multicatégorie : inscriptions, réservations d'horaires, catégories officielles et classement international."
        />

        {/* OG */}
        <meta property="og:title" content="Trophée Mondial de la Pizza Multicatégorie" />
        <meta
          property="og:description"
          content="Concours international pour pizzaiolos professionnels avec inscription, passage chronométré et classement."
        />
        <meta property="og:image" content="/images/logo.png" />
        <meta property="og:url" content="https://www.world-pizza-trophy.com" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content={lang === "fr" ? "fr_FR" : "en_US"} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Trophée Mondial de la Pizza Multicatégorie" />
        <meta
          name="twitter:description"
          content="Inscriptions officielles au concours mondial multicatégorie."
        />
        <meta name="twitter:image" content="/images/logo.png" />
        <meta name="twitter:site" content="@worldpizzatrophy" />
      </head>

      <body className={`${francois.variable} antialiased`} suppressHydrationWarning>
        <TriggerRefreshProvider>{children}</TriggerRefreshProvider>
      </body>
    </html>
  );
}