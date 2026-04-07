"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase/client";
import { signOut, onAuthStateChanged, User as FBUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "./ui/button";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const localeNames: Record<string, string> = {
  fr: "Français",
  it: "Italiano",
  en: "English",
  es: "Español",
};

const localeFlags: Record<string, string> = {
  fr: "🇫🇷 FR",
  en: "🇬🇧 EN",
  es: "🇪🇸 ES",
  it: "🇮🇹 IT",
};

interface FirestoreUser {
  name?: string;
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}

interface HeaderProps {
  lang?: "fr" | "en" | "es" | "it";
  locales?: string[];
}

export default function Header({
  lang = "fr",
  locales = ["fr", "en", "es", "it"],
}: HeaderProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<FirestoreUser | null>(null);
  const [dictionary, setDictionary] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname() || `/${lang}`;

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    getDictionary(lang).then(setDictionary);
  }, [lang]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser: FBUser | null) => {
      if (!firebaseUser) {
        setIsLoggedIn(false);
        setUserData(null);
        return;
      }

      setIsLoggedIn(true);

      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);

        setUserData(snap.exists() ? (snap.data() as FirestoreUser) : null);
      } catch (err) {
        console.error("Erreur Firestore user:", err);
      }
    });

    return () => unsub();
  }, []);

  const switchLocaleUrl = (locale: string) => {
    const parts = pathname.split("/");
    parts[1] = locale;
    return parts.join("/") || `/${locale}`;
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push(`/${lang}`);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (!dictionary) return null;

  const t = dictionary.header;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md py-2 shadow-lg border-b border-gray-100"
          : "bg-white py-4"
      }`}
    >
      <div className="container mx-auto px-4 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <Link href={`/${lang}`} className="relative group shrink-0">
          <Image
            src="/images/logo.png"
            alt="World Pizza Trophy Logo"
            width={120}
            height={80}
            className="object-contain transition-transform duration-300 group-hover:scale-105"
            priority
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden xl:flex items-center space-x-8 font-semibold text-gray-800">
          {[
            { name: t.navigation.home, href: `/${lang}` },
            { name: t.navigation.rules, href: `/${lang}/rules` },
            { name: t.navigation.editions, href: `/${lang}/editions` },
            { name: t.navigation.gallery, href: `/${lang}/gallery` },
            { name: t.navigation.contact, href: `/${lang}/contact` },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative py-2 hover:text-[#8B0000] transition-colors group"
            >
              {item.name}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#8B0000] transition-all duration-300 group-hover:w-full"></span>
            </Link>
          ))}
          {isLoggedIn && userData?.role === 'admin' && (
            <Link
              href={`/${lang}/dashboard`}
              className="py-2 text-[#006400] hover:text-[#8B0000] transition-colors"
            >
              {t.buttons.dashboard}
            </Link>
          )}
        </nav>

        {/* Right Side */}
        <div className="hidden md:flex items-center gap-6">
          {/* Language Switcher - Affiche le drapeau actuel */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-gray-700 hover:text-[#8B0000] hover:bg-gray-50 px-3 text-3xl"
              >
                <span>{localeFlags[lang]}</span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44">
              {locales.map((locale) => (
                <DropdownMenuItem key={locale} asChild>
                  <Link
                    href={switchLocaleUrl(locale)}
                    className={`cursor-pointer flex items-center gap-3 text-lg py-2 ${
                      locale === lang ? "text-[#8B0000] font-bold bg-gray-100" : ""
                    }`}
                  >
                    <span className="text-2xl">{localeFlags[locale]}</span>
                    <span>{localeNames[locale]}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 hidden lg:inline-block">
                  {t.greeting} <span className="font-bold">{userData?.name || "User"}</span>
                </span>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-[#006400] text-[#006400] hover:bg-[#006400] hover:text-white font-bold"
                >
                  <Link href={`/${lang}/account`}>Mon Compte</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="border-[#8B0000] text-[#8B0000] hover:bg-[#8B0000] hover:text-white font-bold"
                >
                  {t.buttons.logout}
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => router.push(`/${lang}/auth/register`)}
                className="bg-[#8B0000] hover:bg-[#A50000] text-white font-bold px-6 shadow-md transition-all hover:shadow-lg active:scale-95"
              >
                {t.buttons.register}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Hamburger */}
        <MobileMenu
          lang={lang}
          locales={locales}
          isLoggedIn={isLoggedIn}
          userName={userData?.name}
          userRole={userData?.role}
          handleLogout={handleLogout}
          switchLocaleUrl={switchLocaleUrl}
          dictionary={dictionary}
        />
      </div>
    </header>
  );
}

function MobileMenu({
  lang,
  locales,
  isLoggedIn,
  userName,
  userRole,
  handleLogout,
  switchLocaleUrl,
  dictionary,
}: any) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setOpen(false);
  }, [router]);

  const t = dictionary.header;

  return (
    <div className="xl:hidden flex items-center gap-4">
      {!isLoggedIn && !open && (
        <Button
          size="sm"
          onClick={() => router.push(`/${lang}/auth/register`)}
          className="bg-[#8B0000] text-white font-bold px-4 text-xs"
        >
          {t.buttons.register}
        </Button>
      )}

      <button
        className="p-2 text-gray-800 focus:outline-none z-[100]"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        <div className="relative w-6 h-5">
          <span
            className={`absolute block h-0.5 w-full bg-current transform transition-all duration-300 ${
              open ? "rotate-45 top-2" : "top-0"
            }`}
          />
          <span
            className={`absolute block h-0.5 w-full bg-current transition-all duration-300 ${
              open ? "opacity-0" : "top-2"
            }`}
          />
          <span
            className={`absolute block h-0.5 w-full bg-current transform transition-all duration-300 ${
              open ? "-rotate-45 top-2" : "top-4"
            }`}
          />
        </div>
      </button>

      <div
        className={`fixed inset-0 bg-white z-[90] flex flex-col transition-transform duration-500 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-8 mt-20 flex flex-col h-full overflow-y-auto">
          <nav className="flex flex-col gap-6 text-2xl font-bold text-gray-900 border-b border-gray-100 pb-8">
            <Link href={`/${lang}`} onClick={() => setOpen(false)}>{t.navigation.home}</Link>
            <Link href={`/${lang}/trophy`} onClick={() => setOpen(false)}>{t.navigation.trophy}</Link>
            <Link href={`/${lang}/rules`} onClick={() => setOpen(false)}>{t.navigation.rules}</Link>
            <Link href={`/${lang}/academy`} onClick={() => setOpen(false)}>{t.navigation.academy}</Link>
            <Link href={`/${lang}/editions`} onClick={() => setOpen(false)}>{t.navigation.editions}</Link>
            <Link href={`/${lang}/gallery`} onClick={() => setOpen(false)}>{t.navigation.gallery}</Link>
            {isLoggedIn && userRole === 'admin' && (
              <Link href={`/${lang}/dashboard`} className="text-[#006400]" onClick={() => setOpen(false)}>
                {t.buttons.dashboard}
              </Link>
            )}
            <Link href={`/${lang}/contact`} onClick={() => setOpen(false)}>{t.navigation.contact}</Link>
          </nav>

          <div className="mt-8 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t.buttons.language}</span>
              <div className="flex gap-4 flex-wrap">
                {locales.map((locale: string) => (
                  <Link
                    key={locale}
                    href={switchLocaleUrl(locale)}
                    className={`px-4 py-2 border rounded-full text-lg font-bold flex items-center gap-2 ${
                      locale === lang ? "bg-[#8B0000] text-white border-[#8B0000]" : "border-gray-200 text-gray-600"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="text-2xl">
                      {localeFlags[locale]}
                    </span>
                    <span>{locale.toUpperCase()}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-auto pb-12 pt-8">
              {isLoggedIn ? (
                <div className="flex flex-col gap-4">
                  <p className="text-gray-600 font-medium text-lg">{t.greeting} <span className="text-gray-900 font-bold">{userName}</span></p>
                  <Button variant="outline" className="w-full border-[#8B0000] text-[#8B0000] font-bold py-6 text-lg" onClick={() => { handleLogout(); setOpen(false); }}>
                    {t.buttons.logout}
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full bg-[#8B0000] hover:bg-[#A50000] text-white font-bold py-6 text-xl shadow-xl"
                  onClick={() => { router.push(`/${lang}/auth/register`); setOpen(false); }}
                >
                  {t.buttons.register}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
