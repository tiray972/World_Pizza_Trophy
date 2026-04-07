"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type SupportedLang = "fr" | "en" | "es" | "it";

interface FooterProps {
  lang?: SupportedLang;
  locales?: string[];
}

export default function Footer({ 
  lang = "fr" as SupportedLang, 
  locales = ["fr", "en", "es", "it"] 
}: FooterProps) {
  const [dictionary, setDictionary] = useState<any>(null);

  useEffect(() => {
    getDictionary(lang).then(setDictionary);
  }, [lang]);

  if (!dictionary) return null;

  const footerContent = {
    fr: {
      quickLinks: "Liens Rapides",
      about: "À Propos",
      rules: "Règlement",
      editions: "Éditions",
      gallery: "Galerie",
      contact: "Contact",
      company: "Compagnie",
      legal: "Légal",
      terms: "Conditions d'utilisation",
      privacy: "Politique de confidentialité",
      about_text: "Le Trophée Mondial de la Pizza est le plus grand concours international de pizza multicatégorie réunissant les meilleurs pizzaïolos du monde.",
      organization: "Organisation",
      contact_email: "contact@worldpizzatrophy.com",
      phone: "+33 (0)1 23 45 67 89",
      address: "123 Rue de la Pizza, 75000 Paris, France",
      follow: "Nous Suivre",
      copyright: "© Trophée Mondial de la Pizza - Tous droits réservés.",
      created_by: "Conçu par UGM Communication"
    },
    en: {
      quickLinks: "Quick Links",
      about: "About",
      rules: "Rules",
      editions: "Editions",
      gallery: "Gallery",
      contact: "Contact",
      company: "Company",
      legal: "Legal",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      about_text: "The World Pizza Trophy is the largest international multi-category pizza competition bringing together the world's best pizza chefs.",
      organization: "Organization",
      contact_email: "contact@worldpizzatrophy.com",
      phone: "+33 (0)1 23 45 67 89",
      address: "123 Pizza Street, 75000 Paris, France",
      follow: "Follow Us",
      copyright: "© World Pizza Trophy - All rights reserved.",
      created_by: "Designed by UGM Communication"
    },
    es: {
      quickLinks: "Enlaces Rápidos",
      about: "Acerca de",
      rules: "Reglas",
      editions: "Ediciones",
      gallery: "Galería",
      contact: "Contacto",
      company: "Empresa",
      legal: "Legal",
      terms: "Términos de Servicio",
      privacy: "Política de Privacidad",
      about_text: "El Trofeo Mundial de Pizza es el mayor concurso internacional de pizza multicategoría que reúne a los mejores pizzeros del mundo.",
      organization: "Organización",
      contact_email: "contact@worldpizzatrophy.com",
      phone: "+33 (0)1 23 45 67 89",
      address: "123 Calle de la Pizza, 75000 París, Francia",
      follow: "Síguenos",
      copyright: "© Trofeo Mundial de Pizza - Todos los derechos reservados.",
      created_by: "Diseñado por UGM Communication"
    },
    it: {
      quickLinks: "Link Rapidi",
      about: "Chi Siamo",
      rules: "Regolamento",
      editions: "Edizioni",
      gallery: "Galleria",
      contact: "Contatti",
      company: "Azienda",
      legal: "Legale",
      terms: "Termini di Servizio",
      privacy: "Politica sulla Privacy",
      about_text: "Il Trofeo Mondiale della Pizza è il più grande concorso internazionale di pizza multicategoria che riunisce i migliori pizzaioli del mondo.",
      organization: "Organizzazione",
      contact_email: "contact@worldpizzatrophy.com",
      phone: "+33 (0)1 23 45 67 89",
      address: "123 Via della Pizza, 75000 Parigi, Francia",
      follow: "Seguici",
      copyright: "© Trofeo Mondiale della Pizza - Tutti i diritti riservati.",
      created_by: "Progettato da UGM Communication"
    }
  };

  const content = footerContent[lang as keyof typeof footerContent] || footerContent.fr;

  return (
    <footer className="px-4 divide-y bg-gradient-to-b from-gray-900 to-gray-950 text-gray-300">
      <div className="container flex flex-col justify-between py-12 mx-auto space-y-8 lg:flex-row lg:space-y-0">
        {/* Logo & About */}
        <div className="lg:w-1/4">
          <Link href={`/${lang}`} className="flex justify-center space-x-3 lg:justify-start mb-4">
            <Image
              src="/images/logo.png"
              width={120}
              height={80}
              alt="World Pizza Trophy Logo"
              className="object-contain"
            />
          </Link>
          <p className="text-sm text-gray-400 text-center lg:text-left leading-relaxed">
            {content.about_text}
          </p>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-2 text-sm gap-x-6 gap-y-8 lg:w-3/4 sm:grid-cols-4">
          {/* Quick Links */}
          <div className="space-y-3">
            <h3 className="tracking-wide uppercase font-bold text-white text-xs">
              {content.quickLinks}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href={`/${lang}`} className="hover:text-[#8B0000] transition-colors">
                  {content.about}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/rules`} className="hover:text-[#8B0000] transition-colors">
                  {content.rules}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/editions`} className="hover:text-[#8B0000] transition-colors">
                  {content.editions}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/gallery`} className="hover:text-[#8B0000] transition-colors">
                  {content.gallery}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Company */}
          <div className="space-y-3">
            <h3 className="tracking-wide uppercase font-bold text-white text-xs">
              {content.company}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href={`/${lang}/contact`} className="hover:text-[#8B0000] transition-colors">
                  {content.contact}
                </Link>
              </li>
              <li>
                <a href="mailto:contact@worldpizzatrophy.com" className="hover:text-[#8B0000] transition-colors">
                  {content.contact_email}
                </a>
              </li>
              <li className="text-gray-500 text-xs">
                {content.phone}
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h3 className="tracking-wide uppercase font-bold text-white text-xs">
              {content.legal}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href={`/${lang}/terms`} className="hover:text-[#8B0000] transition-colors">
                  {content.terms}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/privacy`} className="hover:text-[#8B0000] transition-colors">
                  {content.privacy}
                </Link>
              </li>
            </ul>
          </div>

          {/* Social Media */}
          <div className="space-y-3">
            <h3 className="uppercase font-bold text-white text-xs tracking-wide">
              {content.follow}
            </h3>
            <div className="flex justify-start space-x-4">
              {/* Instagram */}
              <a
                rel="noopener noreferrer"
                href="https://www.instagram.com/worldpizzatrophy/"
                title="Instagram"
                className="flex items-center hover:text-[#8B0000] p-1 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 32 32"
                  fill="currentColor"
                  className="w-5 h-5 fill-current"
                >
                  <path d="M16 0c-4.349 0-4.891 0.021-6.593 0.093-1.709 0.084-2.865 0.349-3.885 0.745-1.052 0.412-1.948 0.959-2.833 1.849-0.891 0.885-1.443 1.781-1.849 2.833-0.396 1.020-0.661 2.176-0.745 3.885-0.077 1.703-0.093 2.244-0.093 6.593s0.021 4.891 0.093 6.593c0.084 1.704 0.349 2.865 0.745 3.885 0.412 1.052 0.959 1.948 1.849 2.833 0.885 0.891 1.781 1.443 2.833 1.849 1.020 0.391 2.181 0.661 3.885 0.745 1.703 0.077 2.244 0.093 6.593 0.093s4.891-0.021 6.593-0.093c1.704-0.084 2.865-0.355 3.885-0.745 1.052-0.412 1.948-0.959 2.833-1.849 0.891-0.885 1.443-1.776 1.849-2.833 0.391-1.020 0.661-2.181 0.745-3.885 0.077-1.703 0.093-2.244 0.093-6.593s-0.021-4.891-0.093-6.593c-0.084-1.704-0.355-2.871-0.745-3.885-0.412-1.052-0.959-1.948-1.849-2.833-0.885-0.891-1.776-1.443-2.833-1.849-1.020-0.396-2.181-0.661-3.885-0.745-1.703-0.077-2.244-0.093-6.593-0.093z"></path>
                </svg>
              </a>

              {/* Facebook */}
              <a
                rel="noopener noreferrer"
                href="https://www.facebook.com/worldpizzatrophy/"
                title="Facebook"
                className="flex items-center hover:text-[#8B0000] p-1 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 32 32"
                  fill="currentColor"
                  className="w-5 h-5 fill-current"
                >
                  <path d="M32 16c0-8.839-7.167-16-16-16s-16 7.161-16 16c0 7.984 5.849 14.604 13.5 15.803v-11.177h-4.063v-4.625h4.063v-3.527c0-4.009 2.385-6.223 6.041-6.223 1.751 0 3.584 0.312 3.584 0.312v3.937h-2.021c-1.989 0-2.461 1.233-2.461 2.499v3.002h4.183l-0.668 4.625h-3.515v11.177c7.645-1.199 13.457-7.819 13.457-15.803z"></path>
                </svg>
              </a>

              {/* Twitter/X */}
              <a
                rel="noopener noreferrer"
                href="https://twitter.com/pizzatrophy/"
                title="Twitter"
                className="flex items-center hover:text-[#8B0000] p-1 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 32 32"
                  fill="currentColor"
                  className="w-5 h-5 fill-current"
                >
                  <path d="M31.939 6.092c-1.18 0.519-2.44 0.872-3.767 1.033 1.352-0.815 2.392-2.099 2.884-3.631-1.268 0.74-2.674 1.276-4.169 1.579-1.195-1.279-2.897-2.079-4.788-2.079-3.623 0-6.56 2.937-6.56 6.556 0 0.52 0.060 1.021 0.169 1.501-5.450-0.274-10.271-2.882-13.503-6.848-0.565 0.975-0.889 2.079-0.889 3.268 0 2.275 1.156 4.287 2.919 5.464-1.075-0.035-2.087-0.329-2.972-0.821v0.081c0 3.18 2.257 5.832 5.261 6.436-0.551 0.15-1.131 0.23-1.729 0.23-0.424 0-0.834-0.041-1.234-0.117 0.834 2.604 3.26 4.503 6.13 4.556-2.243 1.759-5.079 2.807-8.154 2.807-0.53 0-1.052-0.031-1.566-0.092 2.905 1.869 6.356 2.958 10.064 2.958 12.072 0 18.662-10.002 18.662-18.657 0-0.278-0.006-0.556-0.019-0.831 1.283-0.926 2.396-2.082 3.276-3.398z"></path>
                </svg>
              </a>

              {/* YouTube */}
              <a
                rel="noopener noreferrer"
                href="https://www.youtube.com/@worldpizzatrophy/"
                title="YouTube"
                className="flex items-center hover:text-[#8B0000] p-1 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 32 32"
                  fill="currentColor"
                  className="w-5 h-5 fill-current"
                >
                  <path d="M31.681 9.6c0 0-0.313-2.206-1.274-3.175-1.219-1.278-2.582-1.283-3.206-1.358-4.475-0.325-11.194-0.325-11.194-0.325h-0.031c0 0-6.719 0-11.194 0.325-0.625 0.075-1.988 0.081-3.206 1.358-0.962 0.969-1.275 3.175-1.275 3.175s-0.319 2.588-0.319 5.181v2.425c0 2.592 0.319 5.181 0.319 5.181s0.313 2.206 1.274 3.175c1.219 1.278 2.819 1.236 3.531 1.369 2.563 0.245 10.881 0.325 10.881 0.325s6.725-0.015 11.2-0.34c0.625-0.075 1.988-0.081 3.206-1.358 0.962-0.969 1.275-3.175 1.275-3.175s0.319-2.588 0.319-5.181v-2.425c-0.001-2.592-0.319-5.181-0.319-5.181zM12.812 20.572v-9.143l8.206 4.587z"></path>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="py-6 text-sm text-center text-gray-500">
        <p className="mb-2">{content.copyright}</p>
        <p>
          {content.created_by} • 
          <Link href="https://ugm-communication.com" className="text-[#8B0000] hover:text-[#FFD700] ml-1 underline">
            UGM Communication
          </Link>
        </p>
      </div>
    </footer>
  );
}
