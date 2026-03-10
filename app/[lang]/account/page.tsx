'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, CalendarIcon, ClockIcon, Pizza, Loader } from 'lucide-react';

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  country?: string;
  phone?: string;
  registrations: Record<string, any>;
}

interface SlotData {
  id: string;
  categoryId: string;
  categoryName: string;
  date: string;
  startTime: Date;
  endTime: Date;
  status: string;
}

interface CategoryData {
  id: string;
  name: string;
}

export default function AccountPage({ params }: { params: Promise<{ lang: string }> }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userSlots, setUserSlots] = useState<SlotData[]>([]);
  const [categories, setCategories] = useState<Record<string, CategoryData>>({});
  const [pageLoading, setPageLoading] = useState(true);

  const { lang } = use(params);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push(`/${lang}/auth/login?redirect=/account`);
      return;
    }

    const fetchUserData = async () => {
      try {
        // 1. Récupérer les données utilisateur
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          console.error('User not found');
          setPageLoading(false);
          return;
        }

        const data = userSnap.data() as UserData;
        data.id = user.uid;
        setUserData(data);

        // 2. Récupérer tous les slots de l'utilisateur
        const slotsQuery = query(
          collection(db, 'slots'),
          where('userId', '==', user.uid)
        );
        const slotsSnap = await getDocs(slotsQuery);
        const slots: SlotData[] = slotsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            categoryId: data.categoryId,
            categoryName: '',
            date: data.date,
            startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(data.startTime),
            endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(data.endTime),
            status: data.status,
          };
        });

        // 3. Récupérer les catégories pour les noms
        const categoryIds = [...new Set(slots.map(s => s.categoryId))];
        const categoriesMap: Record<string, CategoryData> = {};
        
        for (const catId of categoryIds) {
          const catRef = doc(db, 'categories', catId);
          const catSnap = await getDoc(catRef);
          if (catSnap.exists()) {
            categoriesMap[catId] = {
              id: catId,
              name: catSnap.data().name,
            };
          }
        }

        // Enrichir les slots avec les noms de catégories
        const enrichedSlots = slots.map(slot => ({
          ...slot,
          categoryName: categoriesMap[slot.categoryId]?.name || 'Catégorie inconnue',
        }));

        setUserSlots(enrichedSlots);
        setCategories(categoriesMap);
        setPageLoading(false);

      } catch (error) {
        console.error('Error fetching user data:', error);
        setPageLoading(false);
      }
    };

    fetchUserData();
  }, [user, loading, lang, router]);

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-[#8B0000]" />
          <p className="text-gray-600">Chargement de votre compte...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Erreur</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Impossible de charger vos informations.</p>
            <Button asChild className="w-full">
              <Link href={`/${lang}`}>Retour à l'accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const eventRegistrations = userData.registrations || {};
  const paidSlots = userSlots.filter(s => s.status === 'paid');
  const pendingSlots = userSlots.filter(s => s.status === 'pending');

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Profil utilisateur */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-3xl">Mon Compte</CardTitle>
            <CardDescription>Gérez votre profil et vos réservations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">Nom</p>
                <p className="text-lg font-semibold">
                  {userData.firstName} {userData.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-lg font-semibold">{userData.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Téléphone</p>
                <p className="text-lg font-semibold">{userData.phone || 'Non renseigné'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Pays</p>
                <p className="text-lg font-semibold">{userData.country || 'Non renseigné'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Résumé des événements */}
        {Object.keys(eventRegistrations).length > 0 && (
          <Card className="mb-8 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-6 w-6" />
                Mes Réservations Confirmées
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {Object.entries(eventRegistrations).map(([eventId, registration]: [string, any]) => (
                  <div key={eventId} className="bg-white rounded-lg p-4 border border-green-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-green-700">Événement</p>
                        <p className="text-sm text-gray-600">
                          {registration.categoryIds?.length || 0} catégorie(s) réservée(s)
                        </p>
                      </div>
                      {registration.paid && (
                        <Badge className="bg-green-600 hover:bg-green-700">✓ Payé</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Créneaux payés */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pizza className="h-6 w-6 text-[#8B0000]" />
              Mes Créneaux de Compétition
            </CardTitle>
            <CardDescription>
              {paidSlots.length} créneau(x) confirmé(s) • {pendingSlots.length} en attente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {paidSlots.length === 0 && pendingSlots.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border border-dashed rounded-lg">
                <p>Vous n'avez pas encore de créneaux réservés.</p>
                <Button asChild className="mt-4">
                  <Link href={`/${lang}/booking`}>Réserver maintenant</Link>
                </Button>
              </div>
            ) : (
              <>
                {/* Créneaux payés */}
                {paidSlots.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-green-700">✓ Créneaux Confirmés</h3>
                    {paidSlots.map(slot => (
                      <div
                        key={slot.id}
                        className="bg-green-50 border border-green-200 rounded-lg p-4 flex justify-between items-start"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-900">{slot.categoryName}</p>
                          <div className="flex gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-4 w-4" />
                              {new Date(slot.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <ClockIcon className="h-4 w-4" />
                              {slot.startTime.toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {' - '}
                              {slot.endTime.toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        <Badge className="bg-green-600 hover:bg-green-700">Confirmé</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Créneaux en attente */}
                {pendingSlots.length > 0 && (
                  <div className="space-y-3 mt-6">
                    <h3 className="font-semibold text-yellow-700">⏳ Créneaux en Attente</h3>
                    {pendingSlots.map(slot => (
                      <div
                        key={slot.id}
                        className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex justify-between items-start"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-900">{slot.categoryName}</p>
                          <div className="flex gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-4 w-4" />
                              {new Date(slot.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <ClockIcon className="h-4 w-4" />
                              {slot.startTime.toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        <Badge className="bg-yellow-600 hover:bg-yellow-700">En attente</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button asChild className="bg-[#8B0000] hover:bg-[#A50000]">
            <Link href={`/${lang}/booking`}>Réserver d'autres créneaux</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${lang}`}>Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
