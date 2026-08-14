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
    title: "Galerie photo",
    subtitle: "Revivez en images tous les temps forts de l'édition 2025.",
    empty: "Les photos seront bientôt disponibles.",
    imageAlt: "Trophée Mondial de la Pizza, édition 2025, photo",
    loadMore: "Afficher plus de photos",
    photoCount: "{count} photos de l'édition 2025",
  },
  en: {
    title: "Photo gallery",
    subtitle: "Relive every highlight from the 2025 edition.",
    empty: "Photos will be available soon.",
    imageAlt: "World Pizza Trophy 2025 edition photo",
    loadMore: "Show more photos",
    photoCount: "{count} photos from the 2025 edition",
  },
  es: {
    title: "Galería de fotos",
    subtitle: "Revive todos los grandes momentos de la edición 2025.",
    empty: "Las fotos estarán disponibles próximamente.",
    imageAlt: "Foto del World Pizza Trophy, edición 2025",
    loadMore: "Mostrar más fotos",
    photoCount: "{count} fotos de la edición 2025",
  },
  it: {
    title: "Galleria fotografica",
    subtitle: "Rivivi tutti i momenti più belli dell'edizione 2025.",
    empty: "Le foto saranno presto disponibili.",
    imageAlt: "Foto del World Pizza Trophy, edizione 2025",
    loadMore: "Mostra altre foto",
    photoCount: "{count} foto dell'edizione 2025",
  },
} satisfies Record<SupportedLang, Record<string, string>>;

export default async function GalleryPage({ params }: Props) {
  const resolvedParams = await params;
  const lang = (["fr", "en", "es", "it"].includes(resolvedParams.lang)
    ? resolvedParams.lang
    : "fr") as SupportedLang;
  const content = copy[lang];
  const images = await getEditionImages(2025);

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <Header lang={lang} />
      <main>
        <section className="border-b border-gray-200 bg-[#F7F5F1]">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
            <p className="text-sm font-bold uppercase text-[#8B0000]">Édition 2025</p>
            <h1 className="mt-2 text-4xl font-black uppercase sm:text-6xl">
              {content.title}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-600">
              {content.subtitle}
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <EditionPhotoGallery images={images} copy={content} />
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
