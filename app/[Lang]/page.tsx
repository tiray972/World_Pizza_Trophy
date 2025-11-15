// app/[Lang]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type SupportedLang = "fr" | "en" | "es";

type Props = {
  params: Promise<{ Lang: string }>;
};

export const revalidate = 60;

export default async function Home({ params }: Props) {
  // Unwrap params promise (Next.js 15+)
  const { Lang: rawLang } = await params;
  
  // Validation et typage strict de la langue
  const Lang: SupportedLang = ["fr", "en", "es"].includes(rawLang) 
    ? (rawLang as SupportedLang) 
    : "fr";

  const dictionary = await getDictionary(Lang);

  return (
    <div className="bg-white text-zinc-900 antialiased">
      <Header lang={Lang} />

      {/* HERO */}
      <section
        className="relative h-[78vh] flex items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1920&q=80')` }}
        aria-label={dictionary.home.hero_title}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 text-center max-w-4xl px-6">
          <div className="mx-auto mb-6 w-40 sm:w-56 md:w-64">
            <Image
              src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80"
              alt={dictionary.meta?.site_name || "World Pizza Trophy"}
              width={400}
              height={200}
              className="w-full h-auto mx-auto rounded-lg shadow-2xl"
            />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4 uppercase drop-shadow-lg">
            {dictionary.home.hero_title}
          </h1>

          <p className="text-lg sm:text-xl text-white/90 mb-8">
            {dictionary.home.hero_subtitle}
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href={`/${Lang}/registration`}
              className="inline-block bg-[#c1121f] text-white font-semibold py-3 px-8 rounded-lg hover:bg-[#a40d18] transition shadow-md"
            >
              {dictionary.home.hero_cta_register}
            </Link>

            <Link
              href={`/${Lang}/categories`}
              className="inline-block bg-white text-black font-semibold py-3 px-8 rounded-lg hover:bg-gray-100 transition shadow-sm"
            >
              {dictionary.home.hero_cta_categories}
            </Link>
          </div>
        </div>
      </section>

      {/* INTRO */}
      <section className="py-16 px-6 max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">{dictionary.home.intro_title}</h2>
        <p className="text-lg text-zinc-700">{dictionary.home.intro_text}</p>
      </section>

      {/* STATS */}
      <section className="py-16 bg-[#fdf0d5]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="p-6">
            <span className="block text-5xl font-extrabold text-[#c1121f]">300+</span>
            <p className="mt-2 text-zinc-700">{dictionary.home.numbers_pizzaiolos}</p>
          </div>

          <div className="p-6">
            <span className="block text-5xl font-extrabold text-[#c1121f]">25+</span>
            <p className="mt-2 text-zinc-700">{dictionary.home.numbers_countries}</p>
          </div>

          <div className="p-6">
            <span className="block text-5xl font-extrabold text-[#c1121f]">7</span>
            <p className="mt-2 text-zinc-700">{dictionary.home.numbers_categories}</p>
          </div>
        </div>
      </section>

      {/* WHY PARTICIPATE */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">{dictionary.home.why_title}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="p-6 border rounded-lg shadow-sm">
            <h3 className="font-semibold mb-2">{dictionary.home.why_1_title}</h3>
            <p className="text-sm text-zinc-700">{dictionary.home.why_1_text}</p>
          </div>

          <div className="p-6 border rounded-lg shadow-sm">
            <h3 className="font-semibold mb-2">{dictionary.home.why_2_title}</h3>
            <p className="text-sm text-zinc-700">{dictionary.home.why_2_text}</p>
          </div>

          <div className="p-6 border rounded-lg shadow-sm">
            <h3 className="font-semibold mb-2">{dictionary.home.why_3_title}</h3>
            <p className="text-sm text-zinc-700">{dictionary.home.why_3_text}</p>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-16 text-center bg-[#111827] text-white">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-4">{dictionary.home.cta_bottom_title}</h2>
          <p className="mb-8 text-zinc-300">{dictionary.home.cta_bottom_sub || ""}</p>

          <Link
            href={`/${Lang}/registration`}
            className="inline-block bg-white text-black px-8 py-3 rounded-lg font-semibold shadow hover:bg-gray-200"
          >
            {dictionary.home.cta_bottom_btn}
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}