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
  UtensilsCrossed,
  FileText
} from 'lucide-react';
import { getSlotParticipants } from '@/lib/booking/rules';
import { mealGuestsOfPayment } from '@/lib/invoice/invoice';

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
  metadata?: Record<string, string> | null;
  stripeInvoiceNumber?: string | null;
  stripeInvoicePdf?: string | null;
  stripeInvoiceUrl?: string | null;
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
            participants: data.participants, // 👥 Duo
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
            metadata: data.metadata || null,
            stripeInvoiceNumber: data.stripeInvoiceNumber || null,
            stripeInvoicePdf: data.stripeInvoicePdf || null,
            stripeInvoiceUrl: data.stripeInvoiceUrl || null,
          };
        });
        setPayments(paymentsList);

        // 🧾 Stripe crée la facture quelques secondes après le paiement :
        // on complète à la demande celles qui manquent encore.
        const missingInvoices = paymentsList.filter(
          payment => payment.status === 'paid' && !payment.stripeInvoicePdf && !payment.stripeInvoiceUrl
        );
        if (missingInvoices.length > 0) {
          const idToken = await user.getIdToken();
          for (const payment of missingInvoices) {
            try {
              const response = await fetch('/api/booking/invoice', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ paymentId: payment.id }),
              });
              if (!response.ok) continue;
              const invoice = await response.json();
              if (!invoice.available) continue;
              setPayments(previous =>
                previous.map(item =>
                  item.id === payment.id
                    ? {
                        ...item,
                        stripeInvoiceNumber: invoice.number,
                        stripeInvoicePdf: invoice.pdfUrl,
                        stripeInvoiceUrl: invoice.hostedUrl,
                      }
                    : item
                )
              );
            } catch (invoiceError) {
              console.warn('Facture Stripe indisponible pour le moment:', invoiceError);
            }
          }
        }

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

  const formatLongDate = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

  const formatHour = (date: Date) =>
    date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const paidSlots = userSlots.filter(s => s.status === 'paid');
  const lockedSlots = userSlots.filter(s => s.status === 'locked');
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

  // 👥 Nombre de participants distincts inscrits (duo compris)
  const paidParticipantsCount = new Set(
    paidSlots.flatMap(slot =>
      getSlotParticipants(slot).map(
        participant => `${participant.firstName.trim().toLowerCase()}|${participant.lastName.trim().toLowerCase()}`
      )
    )
  ).size;

  // ⏭️ Prochain passage à venir
  const nextSlot = [...paidSlots]
    .filter(slot => slot.startTime.getTime() >= Date.now())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];

  // 🍽️ Repas payés, reconstitués depuis les paiements
  const mealSummary = payments
    .filter(payment => payment.status === 'paid')
    .reduce<{ total: number; guests: string[] }>(
      (accumulator, payment) => {
        const guests = mealGuestsOfPayment({
          id: payment.id,
          amount: payment.amount,
          createdAt: payment.createdAt,
          slotIds: payment.slotIds,
          metadata: payment.metadata,
        });
        return {
          total: accumulator.total + guests.length,
          guests: [
            ...accumulator.guests,
            ...guests.map(guest => `${guest.firstName} ${guest.lastName}`.trim()).filter(Boolean),
          ],
        };
      },
      { total: 0, guests: [] }
    );

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
                    <div className="text-right space-y-2">
                      <p className="text-lg font-bold text-gray-900">{payment.amount.toFixed(2)} €</p>
                      <Badge className={payment.status === 'paid' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}>
                        {payment.status === 'paid' ? '✓ Payé' : payment.status}
                      </Badge>
                      {payment.status === 'paid' && (
                        <div className="flex flex-col items-end gap-1 mt-1">
                          {/* 🧾 Facture officielle Stripe si elle existe */}
                          {(payment.stripeInvoicePdf || payment.stripeInvoiceUrl) && (
                            <Button asChild size="sm" className="bg-[#8B0000] hover:bg-[#A50000]">
                              <a
                                href={payment.stripeInvoicePdf || payment.stripeInvoiceUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Facture PDF
                                {payment.stripeInvoiceNumber ? ` ${payment.stripeInvoiceNumber}` : ''}
                              </a>
                            </Button>
                          )}
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/${lang}/account/facture/${payment.id}`}>
                              <FileText className="h-4 w-4 mr-1" />
                              {payment.stripeInvoicePdf || payment.stripeInvoiceUrl
                                ? 'Récapitulatif'
                                : 'Facture'}
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 📅 Mon programme de passage */}
        {paidSlots.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pizza className="h-6 w-6 text-[#8B0000]" />
                Mon programme de passage
              </CardTitle>
              <CardDescription>
                {paidSlots.length} créneau(x) confirmé(s) • {paidParticipantsCount} participant(s) inscrit(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* ⏭️ Prochain passage mis en avant */}
              {nextSlot && (
                <div className="rounded-lg border-2 border-[#8B0000] bg-[#8B0000]/5 p-4">
                  <p className="text-xs uppercase font-semibold text-[#8B0000] mb-1">
                    Prochain passage
                  </p>
                  <p className="text-lg font-bold text-gray-900">{nextSlot.categoryName}</p>
                  <p className="text-sm text-gray-700">
                    {formatLongDate(nextSlot.date)} à {formatHour(nextSlot.startTime)}
                    {' — '}
                    {getSlotParticipants(nextSlot).map(p => `${p.firstName} ${p.lastName}`).join(' & ') || 'participant à renseigner'}
                  </p>
                </div>
              )}

              {Object.entries(events).map(([eventId, event]) => {
                const eventSlots = paidSlots
                  .filter(s => s.eventId === eventId)
                  .sort((a, b) =>
                    a.date === b.date
                      ? a.startTime.getTime() - b.startTime.getTime()
                      : a.date.localeCompare(b.date)
                  );
                if (eventSlots.length === 0) return null;

                return (
                  <div key={eventId}>
                    <h3 className="font-semibold text-lg text-gray-900 mb-3">
                      {event.name} ({event.eventYear})
                    </h3>

                    {/* Tableau (écrans moyens et plus) */}
                    <div className="hidden md:block overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-xs uppercase text-gray-500">
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Horaire</th>
                            <th className="px-4 py-3">Catégorie</th>
                            <th className="px-4 py-3">Participant(s)</th>
                            <th className="px-4 py-3">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventSlots.map(slot => (
                            <tr key={slot.id} className="border-t">
                              <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                                {formatLongDate(slot.date)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-700">
                                {formatHour(slot.startTime)} – {formatHour(slot.endTime)}
                              </td>
                              <td className="px-4 py-3">{slot.categoryName}</td>
                              <td className="px-4 py-3">
                                {getSlotParticipants(slot).length === 0 ? (
                                  <span className="text-gray-400">À renseigner</span>
                                ) : (
                                  <div className="space-y-1">
                                    {getSlotParticipants(slot).map((participant, index) => (
                                      <div key={index}>
                                        <span className="font-medium text-gray-900">
                                          {participant.firstName} {participant.lastName}
                                        </span>
                                        {participant.shirtSize && (
                                          <span className="text-xs text-gray-500 ml-2">
                                            T-shirt {participant.shirtSize}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <Badge className="bg-green-600 hover:bg-green-700">✓ Confirmé</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Cartes (mobile) */}
                    <div className="md:hidden space-y-3">
                      {eventSlots.map(slot => (
                        <div key={slot.id} className="rounded-lg border border-green-200 bg-green-50 p-4">
                          <div className="flex justify-between items-start gap-2">
                            <p className="font-semibold text-gray-900">{slot.categoryName}</p>
                            <Badge className="bg-green-600 hover:bg-green-700 shrink-0">✓</Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm text-gray-600 mt-2">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-4 w-4" />
                              {formatLongDate(slot.date)}
                            </span>
                            <span className="flex items-center gap-1 font-mono">
                              <ClockIcon className="h-4 w-4" />
                              {formatHour(slot.startTime)} – {formatHour(slot.endTime)}
                            </span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-green-100 space-y-1">
                            {getSlotParticipants(slot).length === 0 ? (
                              <p className="text-sm text-gray-400">Participant à renseigner</p>
                            ) : (
                              getSlotParticipants(slot).map((participant, index) => (
                                <p key={index} className="text-sm text-gray-800 flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {participant.firstName} {participant.lastName}
                                  {participant.shirtSize && (
                                    <span className="text-xs text-gray-500">
                                      (T-shirt {participant.shirtSize})
                                    </span>
                                  )}
                                </p>
                              ))
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

        {/* 🍽️ Repas réservés */}
        {mealSummary.total > 0 && (
          <Card className="mb-8 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-6 w-6 text-blue-600" />
                Repas réservés
              </CardTitle>
              <CardDescription>
                {mealSummary.total} repas payé(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {mealSummary.guests.map((guest, index) => (
                  <Badge key={index} variant="secondary" className="text-sm py-1">
                    <User className="h-3 w-3 mr-1" />
                    {guest}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Besoin de repas supplémentaires ? Vous pouvez en commander à tout moment depuis la
                page de réservation, sans reprendre de catégorie.
              </p>
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
