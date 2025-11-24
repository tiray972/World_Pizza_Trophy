'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useRouter, usePathname } from 'next/navigation'; // Ajout de usePathname
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

// Icône Google simple
const GoogleIcon = () => (
  <svg role="img" viewBox="0 0 24 24" className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="currentColor"/></svg>
);

// Retrait de { params }
export default function RegisterPage() {
  const router = useRouter();
  const pathname = usePathname(); // Utilisation de usePathname
  
  // Extraction de la langue à partir de l'URL (ex: /fr/auth/register -> fr)
  const currentLang = pathname.split('/')[1] || 'fr'; 

  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const redirectUrl = `/${currentLang}/dashboard`; // Redirige vers le tableau de bord après inscription

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Erreur de mot de passe", { description: "Les mots de passe ne correspondent pas." });
      return;
    }
    
    setIsLoading(true);

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast.success('Inscription réussie !', { description: "Vous êtes maintenant connecté." });
      router.push(redirectUrl);
    } catch (error: any) {
      console.error(error);
      let message = "Une erreur est survenue lors de l'inscription. Veuillez réessayer.";

      if (error.code === 'auth/weak-password') {
          message = "Le mot de passe doit contenir au moins 6 caractères.";
      } else if (error.code === 'auth/email-already-in-use') {
          message = "Cet email est déjà utilisé. Veuillez vous connecter.";
      } else if (error.code === 'auth/invalid-email') {
          message = "L'adresse email est mal formatée.";
      }

      toast.error("Échec de l'inscription", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success('Compte créé et connecté avec Google !');
      router.push(redirectUrl);
    } catch (error: any) {
      console.error(error);
      let message = error.message || "L'inscription via Google a échoué.";

      if (error.code === 'auth/unauthorized-domain') {
        message = "Domaine non autorisé. Veuillez vérifier les paramètres Firebase OAuth.";
      }
      
      toast.error("Erreur Google", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Créer un Compte</CardTitle>
          <CardDescription className="text-center">
            Inscrivez-vous pour commencer
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          
          {/* Inscription Google */}
          <div className="grid grid-cols-1 gap-6">
            <Button variant="outline" onClick={handleGoogleRegister} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
              S'inscrire avec Google
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground bg-card">Ou utiliser votre email</span>
            </div>
          </div>

          {/* Formulaire Email */}
          <form onSubmit={handleRegister} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="nom@exemple.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Minimum 6 caractères"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                disabled={isLoading}
              />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              S'inscrire
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <div className="text-sm text-center text-gray-500">
            Déjà un compte ?{' '}
            <Link href={`/${currentLang}/auth/login`} className="text-primary hover:underline font-semibold">
              Se connecter
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}