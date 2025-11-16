"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase/client";
import { signOut, onAuthStateChanged, User as FBUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Globe } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const localeNames: Record<string, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
};

interface FirestoreUser {
  name?: string;
  email?: string;
  role?: string;
}

interface HeaderProps {
  lang?: "fr" | "en" | "es";
  locales?: string[];
}

export default function Header({
  lang = "fr",
  locales = ["fr", "en", "es"],
}: HeaderProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<FirestoreUser | null>(null);
  const router = useRouter();
  const pathname = usePathname() || `/${lang}`;

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

  return (
    <header className="bg-white text-black shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 flex items-center justify-between py-4">

        {/* Logo */}
        <Link href={`/${lang}`} className="flex items-center gap-2">
          <Image
            src="/images/logo.png"
            alt="Logo"
            width={140}
            height={90}
            className="object-contain hover:scale-110 transition-transform"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex space-x-6 font-medium">
          <Link href={`/${lang}`} className="hover:text-teal-600">Home</Link>
          <Link href={`/${lang}/blog`} className="hover:text-teal-600">About</Link>
          <Link href={`/${lang}/accompagnement`} className="hover:text-teal-600">Visa & Business</Link>
          <Link href={`/${lang}/location`} className="hover:text-teal-600">Properties</Link>
          {isLoggedIn && (
            <Link href={`/${lang}/dashboard`} className="hover:text-teal-600">
              Dashboard
            </Link>
          )}
          <Link href={`/${lang}/contact`} className="hover:text-teal-600">Contact</Link>
        </nav>

        {/* Right Side */}
        <div className="hidden md:flex items-center gap-4">

          {/* language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-700">
                <Globe className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              {locales.map((locale) => (
                <DropdownMenuItem key={locale} asChild>
                  <Link
                    href={switchLocaleUrl(locale)}
                    className={locale === lang ? "font-bold" : ""}
                  >
                    {localeNames[locale]}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Auth Buttons */}
          {isLoggedIn ? (
            <>
              <span className="text-sm font-medium">👋 {userData?.name || "User"}</span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <Button onClick={() => router.push(`/${lang}/auth/signup`)}>
              Sign Up
            </Button>
          )}
        </div>

        {/* Mobile Hamburger */}
        <MobileMenu
          lang={lang}
          locales={locales}
          isLoggedIn={isLoggedIn}
          userName={userData?.name}
          handleLogout={handleLogout}
          switchLocaleUrl={switchLocaleUrl}
        />
      </div>
    </header>
  );
}

/* ========= MOBILE MENU COMPONENT ========= */

function MobileMenu({
  lang,
  locales,
  isLoggedIn,
  userName,
  handleLogout,
  switchLocaleUrl,
}: any) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        className="md:hidden text-gray-700"
        onClick={() => setOpen(!open)}
      >
        <svg className="h-7 w-7" fill="none" stroke="currentColor">
          {open ? (
            <path strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {open && (
        <nav className="absolute top-16 left-0 w-full bg-white shadow-lg p-6 flex flex-col gap-5 text-lg font-medium md:hidden">
          <Link href={`/${lang}`} onClick={() => setOpen(false)}>Home</Link>
          <Link href={`/${lang}/blog`} onClick={() => setOpen(false)}>About</Link>
          <Link href={`/${lang}/accompagnement`} onClick={() => setOpen(false)}>Visa & Business</Link>
          <Link href={`/${lang}/location`} onClick={() => setOpen(false)}>Properties</Link>
          {isLoggedIn && (
            <Link href={`/${lang}/dashboard`} onClick={() => setOpen(false)}>
              Dashboard
            </Link>
          )}
          <Link href={`/${lang}/contact`} onClick={() => setOpen(false)}>Contact</Link>

          <div className="flex flex-col gap-3">
            {locales.map((locale: string) => (
              <Link
                key={locale}
                href={switchLocaleUrl(locale)}
                className="text-sm"
                onClick={() => setOpen(false)}
              >
                🌍 {localeNames[locale]}
              </Link>
            ))}
          </div>

          {isLoggedIn ? (
            <Button variant="outline" onClick={handleLogout}>Logout</Button>
          ) : (
            <Button onClick={() => router.push(`/${lang}/auth/signup`)}>Sign Up</Button>
          )}
        </nav>
      )}
    </>
  );
}
