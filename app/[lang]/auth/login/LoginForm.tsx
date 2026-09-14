"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { authTexts } from "@/lib/i18n/auth-texts";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

export default function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const currentLang = pathname?.split("/")[1] || "fr";
  const t = authTexts(currentLang);
  const redirectPath = searchParams?.get("redirect") || "booking";
  const redirectUrl = `/${currentLang}/${redirectPath}`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace(redirectUrl);
    }
  }, [user, redirectUrl, router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success(t.loginSuccess);
      router.replace(redirectUrl);
    } catch (err: any) {
      console.error(err);
      toast.error(t.loginError, { description: err.message || t.checkCredentials });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success(t.googleSuccess);
      router.replace(redirectUrl);
    } catch (err: any) {
      console.error(err);
      toast.error(t.googleError, { description: err.message || "" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen px-4 bg-gray-50">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-2">{t.loginTitle}</h1>
        <p className="text-sm text-center text-gray-500 mb-4">{t.loginSubtitle}</p>

        <Button
          className="w-full mb-4 flex justify-center items-center"
          variant="outline"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <span>{t.google}</span>
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400">{t.orEmail}</span>
          </div>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleEmailLogin}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="email">{t.email}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="password">{t.password}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <span>{t.submitLogin}</span>
          </Button>
        </form>

        <div className="text-center text-sm mt-4">
          {t.noAccount}{" "}
          <Link href={`/${currentLang}/auth/register`} className="text-primary font-semibold">
            {t.goRegister}
          </Link>
        </div>
        <div className="text-center text-xs mt-2">
          <Link href={`/${currentLang}/auth/forgot-password`} className="text-gray-500 hover:underline">
            {t.forgotPassword}
          </Link>
        </div>
      </div>
    </div>
  );
}