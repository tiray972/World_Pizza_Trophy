'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/providers/AuthProvider';

interface BookingSuccessClientProps {
  lang: string;
}

export default function SuccessClient({ lang }: BookingSuccessClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [paymentRecorded, setPaymentRecorded] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setLoading(false);
      return;
    }

    const processPayment = async () => {
      try {
        // 1️⃣ Récupérer les infos de la session Stripe
        console.log(`🔵 [Success] Fetching session data for ${sessionId}`);
        const sessionResponse = await fetch(`/api/booking/session-status?session_id=${sessionId}`);
        if (sessionResponse.ok) {
          const data = await sessionResponse.json();
          setSessionData(data);
          console.log(`✅ [Success] Session data retrieved:`, data);
        }

        // 2️⃣ Enregistrer le paiement en base de données
        console.log(`🔵 [Success] Recording payment for session ${sessionId}`);
        const recordResponse = await fetch('/api/booking/record-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        if (recordResponse.ok) {
          const recordData = await recordResponse.json();
          console.log(`✅ [Success] Payment recorded:`, recordData);
          setPaymentRecorded(true);
        } else {
          const errorData = await recordResponse.json();
          console.error(`❌ [Success] Failed to record payment:`, errorData);
          setRecordingError(errorData.error || 'Erreur lors de l\'enregistrement du paiement');
        }
      } catch (error) {
        console.error('❌ [Success] Error processing payment:', error);
        setRecordingError('Erreur lors du traitement du paiement');
      } finally {
        setLoading(false);
      }
    };

    processPayment();
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
        <Card className={`${recordingError ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}`}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className={`h-16 w-16 ${recordingError ? 'text-yellow-600' : 'text-green-600'}`} />
            </div>
            <CardTitle className={`text-3xl ${recordingError ? 'text-yellow-700' : 'text-green-700'}`}>
              {recordingError ? '⚠️ Paiement en cours de traitement' : 'Paiement confirmé ! 🍕'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800 mb-2">
                {recordingError ? 'Votre paiement a été reçu' : 'Merci pour votre réservation !'}
              </p>
              <p className="text-gray-600">
                {recordingError 
                  ? 'Il y a eu un léger problème lors de la sauvegarde, mais votre paiement est sécurisé. Contactez-nous si vous n\'avez pas reçu votre confirmation.'
                  : 'Vos créneaux de participation ont été confirmés.'}
              </p>
            </div>

            {recordingError && (
              <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-4">
                <p className="text-sm text-yellow-900 font-semibold">
                  ⚠️ Erreur lors de la sauvegarde : {recordingError}
                </p>
              </div>
            )}

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

            <div className={`${recordingError ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4`}>
              <p className={`text-sm ${recordingError ? 'text-yellow-900' : 'text-blue-900'} font-semibold`}>
                {recordingError ? '⏳ Traitement en cours...' : '📧 Un email de confirmation'}
              </p>
              <p className={`text-sm ${recordingError ? 'text-yellow-800' : 'text-blue-800'} mt-2`}>
                {recordingError 
                  ? 'Veuillez attendre quelques instants, votre commande sera finalisée très bientôt.'
                  : 'a été envoyé à votre adresse. Conservez cet email pour vos références d\'enregistrement.'}
              </p>
            </div>

            <div className="space-y-3 pt-4">
              
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
