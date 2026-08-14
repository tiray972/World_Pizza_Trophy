import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EditionPhotoGallery from "@/components/EditionPhotoGallery";
import { getEditionImages } from "@/lib/edition-images";

type SupportedLang = "fr" | "en" | "es" | "it";

type Props = {
  params: Promise<{ lang: string }> | { lang: string };
};

const copy = {
  fr: {
    eyebrow: "Nos archives",
    title: "Les éditions précédentes",
    intro:
      "Revivez les rencontres, les épreuves et les grands moments qui font l'histoire du Trophée Mondial de la Pizza.",
    edition: "Édition 2025",
    editionText:
      "Une édition portée par la passion, la précision et le partage, réunissant pizzaiolos, jurys et partenaires autour d'un même savoir-faire.",
    location: "Menton, France",
    galleryTitle: "Tous les moments de 2025",
    galleryText:
      "Des fourneaux aux remises de prix, retrouvez l'intégralité des photos disponibles de l'édition 2025.",
    nextEdition: "Prochaine édition",
    nextDate: "27 et 28 octobre 2026",
    register: "S'inscrire à l'édition 2026",
    empty: "Les photos de cette édition seront bientôt disponibles.",
    imageAlt: "Trophée Mondial de la Pizza, édition 2025, photo",
    loadMore: "Afficher plus de photos",
    photoCount: "{count} photos de l'édition 2025",
  },
  en: {
    eyebrow: "Our archives",
    title: "Previous editions",
    intro:
      "Relive the encounters, competitions and defining moments in the history of the World Pizza Trophy.",
    edition: "2025 edition",
    editionText:
      "An edition driven by passion, precision and sharing, bringing pizza chefs, judges and partners together around a shared craft.",
    location: "Menton, France",
    galleryTitle: "Every moment from 2025",
    galleryText:
      "From the ovens to the award ceremonies, discover all available photos from the 2025 edition.",
    nextEdition: "Next edition",
    nextDate: "27 & 28 October 2026",
    register: "Register for the 2026 edition",
    empty: "Photos from this edition will be available soon.",
    imageAlt: "World Pizza Trophy 2025 edition photo",
    loadMore: "Show more photos",
    photoCount: "{count} photos from the 2025 edition",
  },
  es: {
    eyebrow: "Nuestros archivos",
    title: "Ediciones anteriores",
    intro:
      "Revive los encuentros, las pruebas y los grandes momentos que forman la historia del World Pizza Trophy.",
    edition: "Edición 2025",
    editionText:
      "Una edición marcada por la pasión, la precisión y el intercambio entre pizzeros, jurados y colaboradores.",
    location: "Menton, Francia",
    galleryTitle: "Todos los momentos de 2025",
    galleryText:
      "Desde los hornos hasta la entrega de premios, descubre todas las fotos disponibles de la edición 2025.",
    nextEdition: "Próxima edición",
    nextDate: "27 y 28 de octubre de 2026",
    register: "Inscribirse en la edición 2026",
    empty: "Las fotos de esta edición estarán disponibles próximamente.",
    imageAlt: "Foto del World Pizza Trophy, edición 2025",
    loadMore: "Mostrar más fotos",
    photoCount: "{count} fotos de la edición 2025",
  },
  it: {
    eyebrow: "Il nostro archivio",
    title: "Le edizioni precedenti",
    intro:
      "Rivivi gli incontri, le gare e i grandi momenti che hanno fatto la storia del World Pizza Trophy.",
    edition: "Edizione 2025",
    editionText:
      "Un'edizione animata da passione, precisione e condivisione, con pizzaioli, giudici e partner uniti dallo stesso mestiere.",
    location: "Mentone, Francia",
    galleryTitle: "Tutti i momenti del 2025",
    galleryText:
      "Dai forni alle premiazioni, scopri tutte le foto disponibili dell'edizione 2025.",
    nextEdition: "Prossima edizione",
    nextDate: "27 e 28 ottobre 2026",
    register: "Iscriviti all'edizione 2026",
    empty: "Le foto di questa edizione saranno presto disponibili.",
    imageAlt: "Foto del World Pizza Trophy, edizione 2025",
    loadMore: "Mostra altre foto",
    photoCount: "{count} foto dell'edizione 2025",
  },
} satisfies Record<SupportedLang, Record<string, string>>;

export default async function EditionsPage({ params }: Props) {
  const resolvedParams = await params;
  const lang = (["fr", "en", "es", "it"].includes(resolvedParams.lang)
    ? resolvedParams.lang
    : "fr") as SupportedLang;
  const content = copy[lang];
  const images = await getEditionImages(2025);
  const heroImage = images.find((image) => image.endsWith("DW4A3657.JPG")) ?? images[0];

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <Header lang={lang} />

      <main>
        <section className="relative flex min-h-[62vh] items-end overflow-hidden bg-gray-950">
          {heroImage && (
            <Image
              src={heroImage}
              alt={content.imageAlt}
              fill
              unoptimized
              priority
              sizes="100vw"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
          <div className="relative mx-auto w-full max-w-7xl px-5 pb-12 pt-28 sm:px-8 sm:pb-16 lg:px-12">
            <p className="mb-3 text-sm font-bold uppercase text-[#FFD54A]">
              {content.eyebrow}
            </p>
            <h1 className="max-w-4xl text-4xl font-black uppercase text-white sm:text-5xl lg:text-7xl">
              {content.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
              {content.intro}
            </p>
          </div>
        </section>

        <section className="border-b border-gray-200 bg-[#F7F5F1]">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-12 lg:py-16">
            <div>
              <p className="text-sm font-bold uppercase text-[#8B0000]">
                {content.nextEdition}
              </p>
              <h2 className="mt-2 text-3xl font-black text-gray-950 sm:text-4xl">
                {content.nextDate}
              </h2>
            </div>
            <Link
              href={`/${lang}/auth/register`}
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#8B0000] px-6 py-3 font-bold text-white transition-colors hover:bg-[#700000]"
            >
              {content.register}
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <div className="grid gap-8 border-b border-gray-200 pb-12 lg:grid-cols-[1fr_1.2fr] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase text-[#8B0000]">2025</p>
              <h2 className="mt-2 text-4xl font-black uppercase sm:text-5xl">
                {content.edition}
              </h2>
            </div>
            <div>
              <p className="max-w-2xl text-lg leading-8 text-gray-600">
                {content.editionText}
              </p>
              <div className="mt-5 flex flex-wrap gap-5 text-sm font-semibold text-gray-700">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays aria-hidden="true" className="h-4 w-4 text-[#8B0000]" />
                  2025
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin aria-hidden="true" className="h-4 w-4 text-[#006400]" />
                  {content.location}
                </span>
              </div>
            </div>
          </div>

          <div className="pb-8 pt-12">
            <h2 className="text-3xl font-black sm:text-4xl">{content.galleryTitle}</h2>
            <p className="mt-3 max-w-2xl leading-7 text-gray-600">
              {content.galleryText}
            </p>
          </div>

          <EditionPhotoGallery images={images} copy={content} />
        </section>
      </main>

      <Footer lang={lang} />
    </div>
  );
}
