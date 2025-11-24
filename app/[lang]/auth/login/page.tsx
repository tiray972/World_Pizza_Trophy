'use client';

import { useState, useEffect, Suspense } from 'react';
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithRedirect, 
  getRedirectResult,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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

// --- NOUVEAU COMPOSANT CLIENT PRINCIPAL ---
function LoginPageContent() {
  const router = useRouter();
  // Ces hooks causent le problème car ils sont accédés lors du SSR
  const searchParams = useSearchParams(); 
  const pathname = usePathname();
  
  // Extraction de la langue à partir de l'URL
  const currentLang = pathname.split('/')[1] || 'fr'; 
  
  const [isLoading, setIsLoading] = useState(true); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Où rediriger après la connexion ? (par défaut: dashboard dans la langue actuelle)
  const redirectPath = searchParams.get('redirect') || 'dashboard';
  const redirectUrl = `/${currentLang}/${redirectPath}`;

  // 1. Gérer le résultat de la redirection Google (si l'utilisateur revient de Google)
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          toast.success('Connexion réussie avec Google !');
          router.push(redirectUrl);
        }
      })
      .catch((error) => {
        console.error("Erreur de connexion par redirection Google:", error);
        let message = error.message || "La connexion via Google a échoué.";
        
        if (error.code === 'auth/account-exists-with-different-credential') {
          message = "Un compte existe déjà avec cet email via une méthode différente (Email/Mot de passe).";
        } else if (error.code === 'auth/auth-domain-config-required') {
          message = "Erreur de configuration de domaine. Veuillez vérifier vos 'Authorized Domains' dans Firebase.";
        }
        
        toast.error("Échec de la connexion Google", { description: message });
      })
      .finally(() => {
        setIsLoading(false); // Arrêter le chargement après la vérification
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // 2. Connexion Email/Mot de passe
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Connexion réussie !');
      router.push(redirectUrl);
    } catch (error: any) {
      console.error(error);
      let message = "Une erreur est survenue. Veuillez réessayer.";
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          message = "Email ou mot de passe incorrect. Avez-vous un compte ?";
      } else if (error.code === 'auth/network-request-failed') {
          message = "Problème de connexion réseau. Veuillez vérifier votre internet.";
      }
      
      toast.error("Échec de la connexion", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Connexion avec Redirection Google
  const handleGoogleLoginRedirect = async () => {
    if (isLoading) return; 

    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithRedirect(auth, provider);
      // Le navigateur est redirigé ici, le code ci-dessous n'est pas exécuté.
    } catch (error: any) {
      console.error("Erreur lors du lancement de la redirection:", error);
      toast.error("Erreur", { description: "Impossible de démarrer la connexion Google." });
      setIsLoading(false);
    }
  };

  // Afficher un état de chargement initial pendant que nous vérifions le résultat de la redirection
  if (isLoading && !email && !password) {
     return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-600">Vérification de la connexion...</span>
        </div>
      );
  }


  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Connexion</CardTitle>
          <CardDescription className="text-center">
            Entrez vos identifiants pour accéder à votre espace
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          
          {/* Connexion Google (avec redirection) */}
          <div className="grid grid-cols-1 gap-6">
            <Button variant="outline" onClick={handleGoogleLoginRedirect} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
              Continuer avec Google
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground bg-card">Ou continuer avec</span>
            </div>
          </div>

          {/* Formulaire Email */}
          <form onSubmit={handleLogin} className="grid gap-4">
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <div className="text-sm text-center text-gray-500">
            Pas encore de compte ?{' '}
            <Link href={`/${currentLang}/auth/register`} className="text-primary hover:underline font-semibold">
              S'inscrire
            </Link>
          </div>
          <div className="text-xs text-center text-gray-400">
            <Link href={`/${currentLang}/auth/forgot-password`} className="hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// --- ENVELOPPE SUSPENSE POUR PAGE.TSX ---
// Ceci permet à Next.js de rendre le composant côté serveur (SSR) sans 
// casser lors de l'accès aux hooks qui dépendent du client.
export default function LoginPage() {
  const fallbackUI = (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="ml-2 text-gray-600">Chargement de la page de connexion...</span>
    </div>
  );

  return (
    <Suspense fallback={fallbackUI}>
      <LoginPageContent />
    </Suspense>
  );
}