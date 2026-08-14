import React from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

export type HeroImageBackgroundProps = {
  title?: string;
  content: string;
  images: string[];
  lang?: string;
};

const eventDetails = {
  fr: { date: "27 et 28 octobre 2026", cta: "S'inscrire maintenant" },
  en: { date: "27 & 28 October 2026", cta: "Register now" },
  es: { date: "27 y 28 de octubre de 2026", cta: "Inscribirse ahora" },
  it: { date: "27 e 28 ottobre 2026", cta: "Iscriviti ora" },
} as const;

const HeroImageBackground: React.FC<HeroImageBackgroundProps> = ({ title, content, images, lang = "fr" }) => {
  const details = eventDetails[lang as keyof typeof eventDetails] ?? eventDetails.fr;

  return (
  <section className="relative min-h-[66vh] flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: `url('${images[0] || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1920&q=80"}')` }}>
    <div className="absolute inset-0 bg-black/60" />
    <div className="relative z-10 text-center max-w-4xl px-6 py-16">
      <p className="mx-auto mb-5 inline-flex items-center gap-2 border-y border-white/40 py-2 text-sm font-bold uppercase text-[#FFD54A] sm:text-base">
        <CalendarDays aria-hidden="true" className="h-5 w-5" />
        {details.date}
      </p>
      {title && <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 uppercase drop-shadow-lg">{title}</h1>}
      <p className="text-lg sm:text-xl text-white/90 mb-8">{content}</p>
      <Link
        href={`/${lang}/auth/register`}
        className="inline-block bg-[#8B0000] hover:bg-[#A50000] text-white font-bold px-8 py-4 rounded-lg text-lg shadow-lg transition-all hover:shadow-xl hover:scale-105"
      >
        {details.cta}
      </Link>
    </div>
  </section>
  );
};

export default HeroImageBackground;
