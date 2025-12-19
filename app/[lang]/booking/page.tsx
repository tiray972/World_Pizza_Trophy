'use client';

import { SlotBookingView } from "@/components/custom/SlotBookingCalendar";
import { Slot, Category, WPTEvent, Product } from "@/types/firestore";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export default function BookingPage({ params }: { params: { lang: string } }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [event, setEvent] = useState<WPTEvent | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const currentLang = params.lang || 'fr';

  // Load data from Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('📍 [BookingPage] START: Loading data from Firebase');

        // Find the active event (status === 'open')
        const eventsQuery = query(collection(db, 'events'), where('status', '==', 'open'));
        const eventsSnapshot = await getDocs(eventsQuery);
        
        if (eventsSnapshot.empty) {
          console.warn('⚠️  [BookingPage] No active events found');
          toast.error("Aucun événement actif", {
            description: "Aucun événement n'est actuellement disponible pour la réservation.",
          });
          setPageLoading(false);
          return;
        }

        const eventData = eventsSnapshot.docs[0].data() as WPTEvent;
        const eventId = eventsSnapshot.docs[0].id;
        const eventWithId = { ...eventData, id: eventId };
        setEvent(eventWithId);
        console.log('✅ [BookingPage] Event loaded:', { id: eventId, name: eventData.name });

        // Load categories for this event
        const categoriesQuery = query(collection(db, 'categories'), where('eventId', '==', eventId));
        const categoriesSnapshot = await getDocs(categoriesQuery);
        const categoriesData = categoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Category[];
        
        // 🔧 DEBUG: Log raw category data to see structure
        console.log('📋 [BookingPage] Raw category data from Firestore:');
        categoriesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log(`   - ${data.name} (${doc.id}):`, {
            activeDates: data.activeDates,
            activeDatesType: typeof data.activeDates,
            activeDatesLength: Array.isArray(data.activeDates) ? data.activeDates.length : 'N/A',
            allKeys: Object.keys(data)
          });
        });
        
        setCategories(categoriesData);
        console.log('✅ [BookingPage] Categories loaded:', categoriesData.length, 'categories');
        categoriesData.forEach(cat => {
          console.log(`   - ${cat.name} (${cat.id}): activeDates = ${cat.activeDates?.join(', ') || '(EMPTY OR MISSING)'}`);
        });

        // Load slots for this event
        const slotsQuery = query(collection(db, 'slots'), where('eventId', '==', eventId));
        const slotsSnapshot = await getDocs(slotsQuery);
        const slotsData = slotsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Slot[];
        setSlots(slotsData);
        console.log('✅ [BookingPage] Slots loaded:', slotsData.length, 'total slots');
        
        // Log slots by category and status for debugging
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
          
          // Log sample slots for first category
          if (catSlots.length > 0) {
            const sample = catSlots[0];
            console.log(`      Sample slot: date=${sample.date}, status=${sample.status}`);
          }
        });

        // 🔧 FIX: Enrich categories with activeDates from slots if missing
        const enrichedCategories = categoriesData.map(category => {
          // If category has empty or missing activeDates, extract from slots
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
        console.log('✅ [BookingPage] Categories enriched:', enrichedCategories.length, 'categories');
        enrichedCategories.forEach(cat => {
          console.log(`   - ${cat.name} (${cat.id}): activeDates = ${cat.activeDates?.join(', ') || '(EMPTY)'}`);
        });

        // Load products for this event
        const productsQuery = query(collection(db, 'products'), where('eventId', '==', eventId));
        const productsSnapshot = await getDocs(productsQuery);
        const productsData = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        setProducts(productsData);
        console.log('✅ [BookingPage] Products loaded:', productsData.length, 'products');

        setPageLoading(false);
        console.log('✅ [BookingPage] COMPLETE: All data loaded successfully');
      } catch (err: any) {
        console.error("❌ [BookingPage] ERROR loading booking data:", err);
        toast.error("Erreur de chargement", {
          description: "Impossible de charger les données de réservation.",
        });
        setPageLoading(false);
      }
    };

    loadData();
  }, []);

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
          eventId: event?.id,
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
          eventId: event?.id,
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

  if (loading || pageLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Chargement...
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Aucun événement disponible</h1>
          <p className="text-muted-foreground">Revenez plus tard pour des réservations.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`container mx-auto py-10 ${
        isProcessing ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
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
