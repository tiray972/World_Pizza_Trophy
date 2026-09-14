"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { authTexts } from "@/lib/i18n/auth-texts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const pathname = usePathname();
  const currentLang = pathname?.split("/")[1] || "fr";
  const t = authTexts(currentLang);

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setIsSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";

      // 🔒 On ne révèle jamais si l'adresse existe : même écran de confirmation.
      if (code === "auth/user-not-found") {
        setIsSent(true);
      } else if (code === "auth/invalid-email") {
        setError(t.forgotInvalidEmail);
      } else if (code === "auth/too-many-requests") {
        setError(t.forgotTooMany);
      } else {
        console.error("❌ Réinitialisation impossible:", err);
        setError(t.networkError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen px-4 bg-gray-50">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
        {isSent ? (
          <div className="text-center">
            <MailCheck className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t.forgotSent}</h1>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">{t.forgotSentBody}</p>
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3 mb-6 leading-relaxed text-left">
              {t.forgotGoogleHint}
            </p>
            <Button asChild className="w-full">
              <Link href={`/${currentLang}/auth/login`}>
                <span>{t.backToLogin}</span>
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-center mb-2">{t.forgotTitle}</h1>
            <p className="text-sm text-center text-gray-500 mb-6">{t.forgotSubtitle}</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="email">{t.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span>{t.forgotSubmit}</span>
              </Button>
            </form>

            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3 mt-4 leading-relaxed">
              {t.forgotGoogleHint}
            </p>

            <div className="text-center text-sm mt-4">
              <Link href={`/${currentLang}/auth/login`} className="text-primary font-semibold">
                {t.backToLogin}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
