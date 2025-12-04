// app/[lang]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Text4Images2Section from "@/components/sections/new/Text4Images2Section";
import Text4ImagesSection from "@/components/sections/new/Text4Images";
import Text2imagesSection from "@/components/sections/new/text2images";
import ImageTextImage from "@/components/sections/new/ImageTextImage";
import FAQAccordion from "@/components/sections/common/FAQAccordion";
import FullWidthBanner from "@/components/sections/common/FullWidthBanner";
import HeroImageBackground from "@/components/sections/common/HeroImageBackground";
import TestimonialsSlider from "@/components/sections/common/TestimonialsSlider";
import ThreeColumnFeatures from "@/components/sections/common/ThreeColumnFeatures";
import TimelineSection from "@/components/sections/common/TimelineSection";
// import SectionTextImageClipPath from "@/components/sections/new/SectionTextImageClipPath";

type SupportedLang = "fr" | "en" | "es";

type Props = {
  params: { lang: string } | Promise<{ lang: string }>;
};

export const revalidate = 60;

export default async function Home({ params }: Props) {
  // Unwrap promise if needed (Next.js 15+ compatible)
  const resolvedParams = params instanceof Promise ? await params : params;

  const rawLang = resolvedParams.lang;

  // secure & typed language
  const lang: SupportedLang = ["fr", "en", "es"].includes(rawLang)
    ? (rawLang as SupportedLang)
    : "fr";

  const dictionary = await getDictionary(lang);

  
  const pizzaSections = [
    {
      title: dictionary.home.hero.title,
      content: dictionary.home.hero.subtitle,
      images: [
        "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1920&q=80",
        "https://images.unsplash.com/photo-1511689984-6c7a80667a5a?w=1920&q=80",
        "https://images.unsplash.com/photo-1600891964093-4316c288032e?w=1920&q=80", // pizza competition style
        "https://images.unsplash.com/photo-1594007654729-407eedc4be3f?w=1920&q=80"
      ],
      component: HeroImageBackground,
    },
    {
      title: dictionary.home.intro.title,
      content: dictionary.home.intro.text,
      images: [
        "https://images.unsplash.com/photo-1593504049359-74330189a345?q=80&w=627&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=962&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        "https://images.unsplash.com/photo-1594007654729-407eedc4be3f?w=1920&q=80",
      ],
      component: ImageTextImage,
    },
    {
      title: dictionary.home.numbers.title,
      content: `${dictionary.home.numbers.pizzaiolos} | ${dictionary.home.numbers.countries} | ${dictionary.home.numbers.categories}`,
      images: [
        "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=1920&q=80"
      ],
      component: ThreeColumnFeatures,
    },
    {
      title: dictionary.home.why.title,
      content: dictionary.home.why.items.map(i => i.title + ': ' + i.text).join('\n'),
      images: [
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1920&q=80",
        "https://images.unsplash.com/photo-1534939554772-54585f0a60b7?w=1920&q=80"
      ],
      component: Text4ImagesSection,
    },
    {
      title: dictionary.home.cta.title,
      content: dictionary.home.cta.subtitle,
      images: [
        "https://images.unsplash.com/photo-1600891964373-fb57c60d1f30?w=1920&q=80"
      ],
      component: FullWidthBanner,
    },
  ];
  
  return (
    <div className="bg-white text-zinc-900 antialiased">
      <Header lang={lang} />
      {/* Sections dynamiques World Pizza Trophy */}
      {pizzaSections.map((section, idx) => {
        const SectionComponent = section.component;
        return (
          <SectionComponent
            key={idx}
            title={section.title}
            content={section.content}
            images={section.images}
          />
        );
      })}
      {/* <SectionTextImageClipPath
        title="Titre de la section"
        content="Le texte de ta section ici."
        images={["https://images.unsplash.com/photo-1593504049359-74330189a345?q=80&w=627&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"]}
        clipPathSvg="/images/svg/3.svg" // ou "/images/svg/4.svg"
      /> */}
      <Footer />
    </div>
  );
}