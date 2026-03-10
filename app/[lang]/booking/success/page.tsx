'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/providers/AuthProvider';

export default function BookingSuccessPage({ params }: { params: Promise<{ lang: string }> }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [lang, setLang] = useState('fr');
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setLang(resolvedParams.lang);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setLoading(false);
      return;
    }

    const fetchSessionData = async () => {
      try {
        const response = await fetch(`/api/booking/session-status?session_id=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setSessionData(data);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des données de la session:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [searchParams]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentification requise</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Vous devez être connecté pour voir votre commande.</p>
            <Button asChild className="w-full">
              <Link href={`/${lang}/auth/login`}>Se connecter</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-[#8B0000]" />
          <p className="text-gray-600">Vérification de votre paiement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <CardTitle className="text-3xl text-green-700">
              Paiement confirmé ! 🍕
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800 mb-2">
                Merci pour votre réservation !
              </p>
              <p className="text-gray-600">
                Vos créneaux de participation ont été confirmés.
              </p>
            </div>

            {sessionData && (
              <div className="bg-white rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-gray-800 mb-4">Détails de votre commande</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Montant payé</p>
                    <p className="font-semibold text-gray-800">
                      {sessionData.amount ? `${(sessionData.amount / 100).toFixed(2)} €` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Date</p>
                    <p className="font-semibold text-gray-800">
                      {new Date().toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Session ID</p>
                    <p className="font-mono text-xs text-gray-600 break-all">
                      {sessionData.id}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                📧 <strong>Un email de confirmation</strong> a été envoyé à votre adresse.
              </p>
              <p className="text-sm text-blue-800 mt-2">
                Conservez cet email pour vos références d'enregistrement.
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <Button asChild className="w-full bg-[#8B0000] hover:bg-[#A50000]">
                <Link href={`/${lang}/dashboard`}>
                  Voir mon tableau de bord
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/${lang}`}>
                  Retour à l'accueil
                </Link>
              </Button>
            </div>

            <div className="text-center text-sm text-gray-600 border-t pt-4">
              <p>Avez-vous des questions ?</p>
              <Link href={`/${lang}/contact`} className="text-[#8B0000] hover:underline font-semibold">
                Contactez-nous
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
