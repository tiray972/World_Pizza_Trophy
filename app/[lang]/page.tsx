import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Globe2,
  Medal,
  Trophy,
  Users,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { homeContent, getPublicLang } from "@/lib/public-site-content";

type Props = {
  params: Promise<{ lang: string }> | { lang: string };
};

const ASSET_ROOT =
  "https://raw.githubusercontent.com/tiray972/World_Pizza_Trophy/bb3ead84b5dda4f75ce2657dfe91a37044745a7c/public/images/editions/2025";

const photos = {
  hero: `${ASSET_ROOT}/DW4A3657.JPG`,
  competition: `${ASSET_ROOT}/DW4A3087.JPG`,
  people: `${ASSET_ROOT}/DW4A3455.JPG`,
  jury: `${ASSET_ROOT}/DW4A2984.JPG`,
};

const benefitIcons = [Trophy, Globe2, Users];

export const revalidate = 3600;

export default async function Home({ params }: Props) {
  const resolvedParams = await params;
  const lang = getPublicLang(resolvedParams.lang);
  const content = homeContent[lang];

  return (
    <div className="bg-white text-gray-950 antialiased">
      <Header lang={lang} />
      <main>
        <section className="relative flex min-h-[72vh] items-end overflow-hidden bg-gray-950">
          <Image
            src={photos.hero}
            alt={content.title}
            fill
            unoptimized
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/15" />
          <div className="relative mx-auto w-full max-w-7xl px-5 pb-12 pt-24 sm:px-8 sm:pb-16 lg:px-12 lg:pb-20">
            <div className="max-w-4xl">
              <p className="mb-4 inline-flex items-center gap-2 border-y border-white/35 py-2 text-sm font-bold uppercase text-[#FFD54A] sm:text-base">
                <CalendarDays aria-hidden="true" className="h-5 w-5" />
                {content.eventLabel} · {content.date}
              </p>
              <h1 className="text-4xl font-black uppercase text-white sm:text-6xl lg:text-7xl">
                {content.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-xl sm:leading-8">
                {content.subtitle}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/${lang}/auth/register`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#8B0000] px-6 py-3 font-bold text-white transition-colors hover:bg-[#700000]"
                >
                  {content.register}
                  <ArrowRight aria-hidden="true" className="h-5 w-5" />
                </Link>
                <Link
                  href={`/${lang}/rules`}
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/60 bg-black/15 px-6 py-3 font-bold text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-gray-950"
                >
                  {content.categories}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-gray-200 bg-[#F7F5F1]">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
            <div>
              <p className="font-black uppercase text-[#8B0000]">{content.urgency}</p>
              <p className="mt-1 text-sm text-gray-600">{content.urgencyText}</p>
            </div>
            <Link
              href={`/${lang}/auth/register`}
              className="inline-flex items-center gap-2 font-bold text-[#8B0000] hover:text-[#700000]"
            >
              {content.register}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section id="trophy" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase text-[#8B0000]">{content.introEyebrow}</p>
              <h2 className="mt-3 text-3xl font-black uppercase sm:text-5xl">
                {content.introTitle}
              </h2>
            </div>
            <p className="text-lg leading-8 text-gray-600">{content.introText}</p>
          </div>
          <div className="mt-12 grid border-y border-gray-200 sm:grid-cols-3">
            {content.stats.map((stat) => (
              <div key={stat.label} className="px-5 py-8 text-center sm:border-r sm:last:border-r-0">
                <p className="text-5xl font-black text-[#8B0000]">{stat.value}</p>
                <p className="mt-2 font-semibold text-gray-600">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gray-950 text-white">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
            <p className="text-sm font-bold uppercase text-[#FFD54A]">{content.benefitsEyebrow}</p>
            <h2 className="mt-3 text-3xl font-black uppercase sm:text-5xl">{content.benefitsTitle}</h2>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {content.benefits.map((benefit, index) => {
                const Icon = benefitIcons[index];
                return (
                  <article key={benefit.title} className="border-t border-white/20 pt-6">
                    <Icon aria-hidden="true" className="h-7 w-7 text-[#FFD54A]" />
                    <h3 className="mt-5 text-xl font-bold">{benefit.title}</h3>
                    <p className="mt-3 leading-7 text-white/65">{benefit.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase text-[#8B0000]">{content.archiveEyebrow}</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-black uppercase sm:text-5xl">
                {content.archiveTitle}
              </h2>
              <p className="mt-4 max-w-2xl leading-7 text-gray-600">{content.archiveText}</p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3">
              <Link href={`/${lang}/editions`} className="inline-flex items-center gap-2 font-bold text-[#8B0000]">
                {content.archiveLink}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link href={`/${lang}/gallery`} className="inline-flex items-center gap-2 font-bold text-[#006400]">
                {content.galleryLink}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
            {[photos.competition, photos.people, photos.jury].map((src, index) => (
              <div key={src} className={`relative overflow-hidden bg-gray-100 ${index === 0 ? "aspect-[4/3] sm:col-span-2 lg:col-span-1 lg:aspect-auto" : "aspect-[4/3]"}`}>
                <Image src={src} alt={`${content.archiveTitle} ${index + 1}`} fill unoptimized sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" />
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-gray-200 bg-[#F7F5F1]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
            <p className="text-sm font-bold uppercase text-[#006400]">{content.stepsEyebrow}</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black uppercase sm:text-5xl">{content.stepsTitle}</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {content.steps.map((step, index) => (
                <article key={step.title} className="border-t-2 border-[#8B0000] pt-5">
                  <p className="text-sm font-black text-[#8B0000]">0{index + 1}</p>
                  <h3 className="mt-4 text-xl font-bold">{step.title}</h3>
                  <p className="mt-3 leading-7 text-gray-600">{step.text}</p>
                </article>
              ))}
            </div>
            <Link href={`/${lang}/auth/register`} className="mt-10 inline-flex min-h-12 items-center gap-2 rounded-md bg-[#8B0000] px-6 py-3 font-bold text-white hover:bg-[#700000]">
              {content.stepsCta}
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-bold uppercase text-[#8B0000]">{content.faqEyebrow}</p>
              <h2 className="mt-3 text-3xl font-black uppercase sm:text-5xl">{content.faqTitle}</h2>
              <Link href={`/${lang}/rules`} className="mt-6 inline-flex items-center gap-2 font-bold text-[#8B0000]">
                {content.faqLink}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
            <div className="divide-y divide-gray-200 border-y border-gray-200">
              {content.faq.map((item) => (
                <details key={item.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                    {item.question}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gray-300 text-lg group-open:bg-[#8B0000] group-open:text-white">+</span>
                  </summary>
                  <p className="max-w-2xl pb-2 pt-4 leading-7 text-gray-600">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#8B0000] text-white">
          <div className="absolute right-0 top-0 h-full w-1/3 bg-[#006400]" />
          <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-5 py-14 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
            <div>
              <Medal aria-hidden="true" className="mb-4 h-8 w-8 text-[#FFD54A]" />
              <h2 className="text-3xl font-black uppercase sm:text-4xl">{content.finalTitle}</h2>
              <p className="mt-3 max-w-2xl text-white/80">{content.finalText}</p>
            </div>
            <Link href={`/${lang}/auth/register`} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-6 py-3 font-bold text-[#8B0000] hover:bg-[#F7F5F1]">
              {content.finalCta}
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Link>
          </div>
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
