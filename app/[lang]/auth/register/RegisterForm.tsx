"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function RegisterForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLang = pathname?.split("/")[1] || "fr";
  const redirectPath = searchParams?.get("redirect") || "booking";
  const redirectUrl = `/${currentLang}/${redirectPath}`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast.success("Inscription réussie !");
      router.replace(redirectUrl);
    } catch (err: any) {
      toast.error("Erreur lors de l'inscription", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Inscription réussie avec Google !");
      router.replace(redirectUrl);
    } catch (err: any) {
      toast.error("Erreur Google", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-2">Créer un Compte</h1>
        <p className="text-sm text-center text-gray-500 mb-4">Inscrivez-vous pour commencer</p>
        <Button variant="outline" onClick={handleGoogleRegister} disabled={isLoading} className="w-full mb-4 flex justify-center items-center">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          S'inscrire avec Google
        </Button>
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400">Ou utiliser votre email</span>
          </div>
        </div>
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="nom@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" placeholder="Minimum 6 caractères" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isLoading} />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            S'inscrire
          </Button>
        </form>
        <div className="text-center text-sm mt-4">
          Déjà un compte ?{" "}
          <Link href={`/${currentLang}/auth/login`} className="text-primary font-semibold">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
