'use client';

import { SlotBookingView } from "@/components/custom/SlotBookingCalendar";
import { Slot, Category, WPTEvent, Product } from "@/types/firestore";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BookingPage({ params }: { params: Promise<{ lang: string }> }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Multi-event state
  const [openEvents, setOpenEvents] = useState<WPTEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Data state (depends on selectedEventId)
  const [event, setEvent] = useState<WPTEvent | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const { lang } = use(params);
  const currentLang = lang || 'fr';

  // 🔥 Phase 1: Load all open events
  useEffect(() => {
    const loadOpenEvents = async () => {
      try {
        console.log('📍 [BookingPage] Phase 1: Loading open events');

        const eventsQuery = query(collection(db, 'events'), where('status', '==', 'open'));
        const eventsSnapshot = await getDocs(eventsQuery);

        if (eventsSnapshot.empty) {
          console.warn('⚠️  [BookingPage] No open events found');
          toast.error("Aucun événement disponible", {
            description: "Aucun événement n'est actuellement ouvert pour la réservation.",
          });
          setOpenEvents([]);
          setPageLoading(false);
          return;
        }

        const rawEvents: WPTEvent[] = eventsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            eventYear: data.eventYear,
            eventStartDate: (data.eventStartDate as Timestamp).toDate(),
            eventEndDate: (data.eventEndDate as Timestamp).toDate(),
            registrationDeadline: (data.registrationDeadline as Timestamp).toDate(),
            status: data.status,
          } as WPTEvent;
        });

        console.log(`✅ [BookingPage] Found ${rawEvents.length} open event(s):`, rawEvents.map(e => e.name));
        setOpenEvents(rawEvents);

        // Auto-select if only one event
        if (rawEvents.length === 1) {
          console.log(`✨ [BookingPage] Auto-selecting single event: ${rawEvents[0].name}`);
          setSelectedEventId(rawEvents[0].id);
        }
      } catch (err: any) {
        console.error("❌ [BookingPage] ERROR loading open events:", err);
        toast.error("Erreur de chargement", {
          description: "Impossible de charger les événements disponibles.",
        });
        setPageLoading(false);
      }
    };

    loadOpenEvents();
  }, []);

  // 🔥 Phase 2: Load event-specific data when selectedEventId changes
  useEffect(() => {
    if (!selectedEventId) {
      setPageLoading(false);
      return;
    }

    const loadEventData = async () => {
      try {
        setPageLoading(true);
        console.log(`📍 [BookingPage] Phase 2: Loading data for event ${selectedEventId}`);

        // Find selected event from loaded events
        const selectedEvent = openEvents.find(e => e.id === selectedEventId);
        if (!selectedEvent) {
          console.error(`❌ [BookingPage] Event ${selectedEventId} not found in openEvents`);
          toast.error("Événement introuvable", {
            description: "L'événement sélectionné n'a pas pu être chargé.",
          });
          setPageLoading(false);
          return;
        }

        setEvent(selectedEvent);
        console.log(`✅ [BookingPage] Event set: ${selectedEvent.name}`);

        // Load categories for this event
        const categoriesQuery = query(
          collection(db, 'categories'),
          where('eventId', '==', selectedEventId)
        );
        const categoriesSnapshot = await getDocs(categoriesQuery);
        const categoriesData = categoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Category[];

        console.log(`📋 [BookingPage] Raw category data from Firestore (eventId: ${selectedEventId}):`);
        categoriesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log(`   - ${data.name} (${doc.id}):`, {
            activeDates: data.activeDates,
            activeDatesType: typeof data.activeDates,
            activeDatesLength: Array.isArray(data.activeDates) ? data.activeDates.length : 'N/A',
          });
        });

        // Load slots for this event
        const slotsQuery = query(
          collection(db, 'slots'),
          where('eventId', '==', selectedEventId)
        );
        const slotsSnapshot = await getDocs(slotsQuery);
        const slotsData = slotsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            eventId: data.eventId,
            categoryId: data.categoryId,
            date: data.date,
            startTime: (data.startTime as Timestamp).toDate(),
            endTime: (data.endTime as Timestamp).toDate(),
            status: data.status,
            userId: data.userId,
            stripeSessionId: data.stripeSessionId,
            assignedByAdminId: data.assignedByAdminId,
            assignedAt: data.assignedAt ? (data.assignedAt as Timestamp).toDate() : undefined,
            assignmentType: data.assignmentType,
          } as Slot;
        });

        console.log(`✅ [BookingPage] Slots loaded: ${slotsData.length} total slots`);
        const slotsByCategory: Record<string, Slot[]> = {};
        slotsData.forEach(slot => {
          if (!slotsByCategory[slot.categoryId]) {
            slotsByCategory[slot.categoryId] = [];
          }
          slotsByCategory[slot.categoryId].push(slot);
        });

        Object.entries(slotsByCategory).forEach(([catId, catSlots]) => {
          const availableCount = catSlots.filter(s => s.status === 'available').length;
          const totalCount = catSlots.length;
          console.log(`   - Category ${catId}: ${availableCount}/${totalCount} available`);
        });

        // 🔧 FIX: Enrich categories with activeDates from slots if missing
        const enrichedCategories = categoriesData.map(category => {
          if (!category.activeDates || category.activeDates.length === 0) {
            const datesFromSlots = Array.from(
              new Set(
                slotsData
                  .filter(slot => slot.categoryId === category.id && slot.status === 'available')
                  .map(slot => slot.date)
              )
            ).sort();

            console.log(`🔧 [BookingPage] Enriching category ${category.name}: extracted dates from slots:`, datesFromSlots);

            return {
              ...category,
              activeDates: datesFromSlots
            };
          }
          return category;
        });

        setCategories(enrichedCategories);
        setSlots(slotsData);
        console.log(`✅ [BookingPage] Categories enriched: ${enrichedCategories.length} categories`);
        enrichedCategories.forEach(cat => {
          console.log(`   - ${cat.name} (${cat.id}): activeDates = ${cat.activeDates?.join(', ') || '(EMPTY)'}`);
        });

        // Load products for this event
        const productsQuery = query(
          collection(db, 'products'),
          where('eventId', '==', selectedEventId)
        );
        const productsSnapshot = await getDocs(productsQuery);
        const productsData = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];

        setProducts(productsData);
        console.log(`✅ [BookingPage] Products loaded: ${productsData.length} products`);
        setPageLoading(false);
        console.log(`✅ [BookingPage] COMPLETE: All data loaded for event ${selectedEventId}`);
      } catch (err: any) {
        console.error("❌ [BookingPage] ERROR loading event data:", err);
        toast.error("Erreur de chargement", {
          description: "Impossible de charger les données de l'événement.",
        });
        setPageLoading(false);
      }
    };

    loadEventData();
  }, [selectedEventId, openEvents]);

  const handleError = (msg: string) => {
    toast.error("Une erreur est survenue", {
      description: msg,
      duration: 5000,
    });
    setIsProcessing(false);
  };

  const handleCheckout = async (
    slotsToCheckout: { slotId: string; categoryId: string }[]
  ) => {
    if (!user) {
      const loginUrl = `/${currentLang}/auth/login?redirect=/booking`;
      toast.info("Connexion requise", {
        description: "Vous devez être connecté pour réserver.",
      });
      router.push(loginUrl);
      return;
    }

    setIsProcessing(true);
    toast.loading("Préparation du paiement...", { id: "checkout-loading" });

    try {
      const res = await fetch('/api/booking/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotsToReserve: slotsToCheckout,
          userId: user.uid,
          userEmail: user.email,
          eventId: selectedEventId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.dismiss("checkout-loading");
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      toast.dismiss("checkout-loading");
      handleError(err.message);
    }
  };

  const handlePackCheckout = async (
    product: Product,
    slotsToCheckout: { slotId: string; categoryId: string }[]
  ) => {
    if (!user) {
      const loginUrl = `/${currentLang}/auth/login?redirect=/booking`;
      router.push(loginUrl);
      return;
    }

    setIsProcessing(true);
    toast.loading("Configuration du pack...", { id: "pack-loading" });

    try {
      const res = await fetch('/api/booking/checkout-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productStripePriceId: product.stripePriceId,
          slotsToReserve: slotsToCheckout,
          userId: user.uid,
          userEmail: user.email,
          eventId: selectedEventId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.dismiss("pack-loading");
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      toast.dismiss("pack-loading");
      handleError(err.message);
    }
  };

  const registrationClosed = event
    ? Date.now() > event.registrationDeadline.getTime()
    : false;

  // Loading state
  if (loading || pageLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Chargement...
      </div>
    );
  }

  // No open events
  if (openEvents.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Aucun événement disponible</h1>
          <p className="text-muted-foreground">Revenez plus tard pour des réservations.</p>
        </div>
      </div>
    );
  }

  // Multiple events: show selector
  if (openEvents.length > 1 && !selectedEventId) {
    return (
      <div className="container mx-auto py-10">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Sélectionnez un Événement</CardTitle>
              <CardDescription>
                Plusieurs événements sont actuellement ouverts pour la réservation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {openEvents.map(evt => (
                  <Card
                    key={evt.id}
                    className="cursor-pointer transition-all hover:shadow-lg border-gray-200 hover:border-primary"
                    onClick={() => setSelectedEventId(evt.id)}
                  >
                    <CardHeader className="p-4">
                      <CardTitle className="text-lg">{evt.name}</CardTitle>
                      <CardDescription className="text-sm">
                        Année: {evt.eventYear} | Du{' '}
                        {evt.eventStartDate.toLocaleDateString('fr-FR')} au{' '}
                        {evt.eventEndDate.toLocaleDateString('fr-FR')}
                      </CardDescription>
                      <p className="text-xs text-gray-500 mt-2">
                        Deadline: {evt.registrationDeadline.toLocaleDateString('fr-FR')}
                      </p>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // No event selected (shouldn't happen with auto-select, but safety check)
  if (!event) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Événement non trouvé</h1>
          <p className="text-muted-foreground">Veuillez réessayer.</p>
        </div>
      </div>
    );
  }

  // Render booking view
  return (
    <div
      className={`container mx-auto py-10 ${
        isProcessing ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      {/* Event selector for multiple events (shown if user navigates back) */}
      {openEvents.length > 1 && (
        <div className="mb-6 pb-6 border-b">
          <p className="text-sm font-semibold text-gray-600 mb-3">Événement actif:</p>
          <Tabs value={selectedEventId || ''} onValueChange={setSelectedEventId}>
            <TabsList className="grid" style={{ gridTemplateColumns: `repeat(${openEvents.length}, 1fr)` }}>
              {openEvents.map(evt => (
                <TabsTrigger key={evt.id} value={evt.id}>
                  {evt.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <SlotBookingView
        availableSlots={slots}
        categories={categories}
        settings={event}
        products={products.filter(p => p.isActive)}
        registrationClosed={registrationClosed}
        onCheckout={handleCheckout}
        onPackCheckout={handlePackCheckout}
      />
    </div>
  );
}
