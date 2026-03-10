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
import { 
  CheckCircle, 
  CalendarIcon, 
  ClockIcon, 
  Pizza, 
  Loader, 
  User,
  CreditCard,
  DollarSign,
  AlertCircle,
  Download
} from 'lucide-react';

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
  eventId: string;
  categoryId: string;
  categoryName: string;
  date: string;
  startTime: Date;
  endTime: Date;
  status: string;
  participant?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  paidAt?: Date;
  assignmentType?: string;
}

interface PaymentData {
  id: string;
  eventId: string;
  amount: number;
  status: string;
  source: string;
  createdAt: Date;
  slotIds: string[];
  isPack: boolean;
  packName?: string;
}

interface EventData {
  id: string;
  name: string;
  eventYear: number;
  eventStartDate: Date;
  eventEndDate: Date;
}

interface CategoryData {
  id: string;
  name: string;
  unitPrice: number;
}

export default function AccountPage({ params }: { params: Promise<{ lang: string }> }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userSlots, setUserSlots] = useState<SlotData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [events, setEvents] = useState<Record<string, EventData>>({});
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

        // 2. Récupérer tous les slots de l'utilisateur (par buyerId)
        const slotsQuery = query(
          collection(db, 'slots'),
          where('buyerId', '==', user.uid)
        );
        const slotsSnap = await getDocs(slotsQuery);
        const slots: SlotData[] = slotsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            eventId: data.eventId,
            categoryId: data.categoryId,
            categoryName: '',
            date: data.date,
            startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(data.startTime),
            endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(data.endTime),
            status: data.status,
            participant: data.participant,
            paidAt: data.paidAt instanceof Timestamp ? data.paidAt.toDate() : data.paidAt,
            assignmentType: data.assignmentType,
          };
        });

        // 3. Récupérer tous les paiements de l'utilisateur
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('userId', '==', user.uid)
        );
        const paymentsSnap = await getDocs(paymentsQuery);
        const paymentsList: PaymentData[] = paymentsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            eventId: data.eventId,
            amount: data.amount,
            status: data.status,
            source: data.source,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
            slotIds: data.slotIds || [],
            isPack: data.isPack || false,
            packName: data.packName,
          };
        });
        setPayments(paymentsList);

        // 4. Récupérer les catégories pour les noms et prix
        const categoryIds = [...new Set(slots.map(s => s.categoryId))];
        const categoriesMap: Record<string, CategoryData> = {};
        
        for (const catId of categoryIds) {
          const catRef = doc(db, 'categories', catId);
          const catSnap = await getDoc(catRef);
          if (catSnap.exists()) {
            categoriesMap[catId] = {
              id: catId,
              name: catSnap.data().name,
              unitPrice: catSnap.data().unitPrice,
            };
          }
        }

        // 5. Récupérer les événements
        const eventIds = [...new Set(slots.map(s => s.eventId))];
        const eventsMap: Record<string, EventData> = {};
        
        for (const eventId of eventIds) {
          const eventRef = doc(db, 'events', eventId);
          const eventSnap = await getDoc(eventRef);
          if (eventSnap.exists()) {
            const eventData = eventSnap.data();
            eventsMap[eventId] = {
              id: eventId,
              name: eventData.name,
              eventYear: eventData.eventYear,
              eventStartDate: eventData.eventStartDate instanceof Timestamp ? eventData.eventStartDate.toDate() : new Date(eventData.eventStartDate),
              eventEndDate: eventData.eventEndDate instanceof Timestamp ? eventData.eventEndDate.toDate() : new Date(eventData.eventEndDate),
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
        setEvents(eventsMap);
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

  const paidSlots = userSlots.filter(s => s.status === 'paid');
  const lockedSlots = userSlots.filter(s => s.status === 'locked');
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        
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

        {/* Résumé financier */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-green-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Montant Payé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-900">{totalPaidAmount.toFixed(2)} €</p>
              <p className="text-xs text-green-700 mt-1">{payments.filter(p => p.status === 'paid').length} paiement(s)</p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                <Pizza className="h-4 w-4" />
                Créneaux Payés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-900">{paidSlots.length}</p>
              <p className="text-xs text-blue-700 mt-1">Confirmés et prêts</p>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-yellow-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Créneaux Verrouillés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-900">{lockedSlots.length}</p>
              <p className="text-xs text-yellow-700 mt-1">En cours de paiement</p>
            </CardContent>
          </Card>
        </div>

        {/* Historique des paiements */}
        {payments.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-[#8B0000]" />
                Historique des Paiements
              </CardTitle>
              <CardDescription>
                {payments.length} transaction(s) trouvée(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {payments.map(payment => (
                  <div
                    key={payment.id}
                    className={`border rounded-lg p-4 flex justify-between items-start ${
                      payment.status === 'paid'
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">
                        {payment.isPack ? `📦 ${payment.packName}` : `🎫 ${payment.slotIds.length} créneau(x)`}
                      </p>
                      <p className="text-sm text-gray-600">
                        {events[payment.eventId]?.name || 'Événement'} • {payment.createdAt.toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-xs text-gray-500">
                        ID: {payment.id.substring(0, 12)}... • Source: {payment.source}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{payment.amount.toFixed(2)} €</p>
                      <Badge className={payment.status === 'paid' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}>
                        {payment.status === 'paid' ? '✓ Payé' : payment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mes Créneaux par Événement */}
        {paidSlots.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pizza className="h-6 w-6 text-[#8B0000]" />
                Mes Créneaux de Compétition
              </CardTitle>
              <CardDescription>
                {paidSlots.length} créneau(x) confirmé(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ... existing code ...*/}
              {Object.entries(events).map(([eventId, event]) => {
                const eventSlots = paidSlots.filter(s => s.eventId === eventId);
                if (eventSlots.length === 0) return null;

                return (
                  <div key={eventId} className="border-b pb-6 last:border-b-0">
                    <h3 className="font-semibold text-lg text-gray-900 mb-4">
                      {event.name} ({event.eventYear})
                    </h3>
                    <div className="space-y-3">
                      {eventSlots.map(slot => (
                        <div
                          key={slot.id}
                          className="bg-green-50 border border-green-200 rounded-lg p-4"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Slot Details */}
                            <div>
                              <p className="font-semibold text-gray-900">{slot.categoryName}</p>
                              <div className="flex gap-4 text-sm text-gray-600 mt-2">
                                <span className="flex items-center gap-1">
                                  <CalendarIcon className="h-4 w-4" />
                                  {new Date(slot.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
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

                            {/* Participant Info */}
                            {slot.participant && (
                              <div className="bg-white rounded p-3 border border-green-100">
                                <p className="text-xs text-gray-500 font-semibold mb-2 flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  Participant
                                </p>
                                <p className="font-semibold text-gray-900">
                                  {slot.participant.firstName} {slot.participant.lastName}
                                </p>
                                {slot.participant.email && (
                                  <p className="text-sm text-gray-600">{slot.participant.email}</p>
                                )}
                                {slot.participant.phone && (
                                  <p className="text-sm text-gray-600">{slot.participant.phone}</p>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2 mt-3 pt-3 border-t border-green-100">
                            <Badge className="bg-green-600 hover:bg-green-700">✓ Confirmé</Badge>
                            {slot.paidAt && (
                              <span className="text-xs text-gray-500">
                                Payé le {slot.paidAt.toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Créneaux en attente de paiement */}
        {lockedSlots.length > 0 && (
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700">
                <AlertCircle className="h-6 w-6" />
                Créneaux en Attente de Paiement
              </CardTitle>
              <CardDescription className="text-yellow-700">
                {lockedSlots.length} créneau(x) en cours de paiement (10 minutes restantes)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {lockedSlots.map(slot => (
                <div key={slot.id} className="bg-white border border-yellow-200 rounded-lg p-4 flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900">{slot.categoryName}</p>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        {new Date(slot.date + 'T00:00:00').toLocaleDateString('fr-FR')}
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
                  <Badge className="bg-yellow-600 hover:bg-yellow-700">⏳ En attente</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Message si aucun créneau */}
        {paidSlots.length === 0 && lockedSlots.length === 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Aucun créneau réservé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">Vous n'avez pas encore de créneaux réservés. Commencez par réserver un créneau pour participer à l'événement.</p>
              <Button asChild className="bg-[#8B0000] hover:bg-[#A50000]">
                <Link href={`/${lang}/booking`}>Réserver un créneau</Link>
              </Button>
            </CardContent>
          </Card>
        )}

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
