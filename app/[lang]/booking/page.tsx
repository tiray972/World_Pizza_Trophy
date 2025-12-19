'use client';

import { SlotBookingView } from "@/components/custom/SlotBookingCalendar";
import { Slot, Category, WPTEvent, Product } from "@/types/firestore";
import { Timestamp } from "firebase/firestore";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";

const EVENT_YEAR = 2025;

// Dates réelles de l’événement
const day1 = new Date(2025, 10, 4, 9, 0, 0); // 4 novembre 2025
const day2 = new Date(2025, 10, 5, 9, 0, 0); // 5 novembre 2025

const day1ISO = day1.toISOString().split('T')[0]; // 2025-11-04
const day2ISO = day2.toISOString().split('T')[0]; // 2025-11-05

const regDeadline = new Date(2025, 12, 22); // 20 octobre 2025

export const MOCK_EVENT: WPTEvent = {
    id: 'event_wpt_2025',
    name: 'World Pizza Trophy',
    eventYear: 2025,
    eventStartDate: Timestamp.fromDate(day1),
    eventEndDate: Timestamp.fromDate(day2),
    registrationDeadline: Timestamp.fromDate(regDeadline),
    status: 'open',
  };
  export const MOCK_CATEGORIES: Category[] = [
    {
      id: 'cat_classique',
      eventId: 'event_wpt_2025',
      name: 'Pizza Classique',
      description: 'La tradition italienne.',
      unitPrice: 120,
      maxSlots: 60,
      durationMinutes: 10,
      activeDates: [day1ISO, day2ISO],
      isActive: true,
    },
    {
      id: 'cat_calzone',
      eventId: 'event_wpt_2025',
      name: 'Calzone',
      description: 'Le classique replié.',
      unitPrice: 100,
      maxSlots: 30,
      durationMinutes: 10,
      activeDates: [day1ISO, day2ISO],
      isActive: true,
    },
    {
      id: 'cat_napo',
      eventId: 'event_wpt_2025',
      name: 'Napolitaine',
      description: 'Vera Pizza Napoletana.',
      unitPrice: 180,
      maxSlots: 20,
      durationMinutes: 10,
      activeDates: [day1ISO],
      isActive: true,
    },
    {
      id: 'cat_focaccia',
      eventId: 'event_wpt_2025',
      name: 'Focaccia',
      description: 'Pain plat à l’huile d’olive.',
      unitPrice: 80,
      maxSlots: 20,
      durationMinutes: 10,
      activeDates: [day2ISO],
      isActive: true,
    },
  ];
  export const MOCK_PRODUCTS: Product[] = [
    {
      id: 'pack_gold',
      eventId: 'event_wpt_2025',
      name: 'Pack Compétiteur OR',
      description: '3 catégories + repas VIP',
      stripePriceId: 'price_gold_xyz',
      unitAmount: 30000, // cents
      slotsRequired: 3,
      isPack: true,
      includesMeal: true,
      isActive: true,
    },
    {
      id: 'pack_duo',
      eventId: 'event_wpt_2025',
      name: 'Pack Duo',
      description: '2 catégories pour 2 personnes',
      stripePriceId: 'price_duo_abc',
      unitAmount: 18000,
      slotsRequired: 2,
      isPack: true,
      includesMeal: false,
      isActive: true,
    },
  ];
  export const MOCK_SLOTS: Slot[] = [
    {
      id: 'slot_classique_1',
      eventId: 'event_wpt_2025',
      categoryId: 'cat_classique',
      date: day1ISO,
      startTime: Timestamp.fromDate(new Date(2025, 10, 4, 10, 0)),
      endTime: Timestamp.fromDate(new Date(2025, 10, 4, 10, 10)),
      status: 'available',
      stripeSessionId: null,
    },
    {
      id: 'slot_napo_1',
      eventId: 'event_wpt_2025',
      categoryId: 'cat_napo',
      date: day1ISO,
      startTime: Timestamp.fromDate(new Date(2025, 10, 4, 11, 0)),
      endTime: Timestamp.fromDate(new Date(2025, 10, 4, 11, 10)),
      status: 'available',
      stripeSessionId: null,
    },
    {
      id: 'slot_focaccia_1',
      eventId: 'event_wpt_2025',
      categoryId: 'cat_focaccia',
      date: day2ISO,
      startTime: Timestamp.fromDate(new Date(2025, 10, 5, 10, 0)),
      endTime: Timestamp.fromDate(new Date(2025, 10, 5, 10, 10)),
      status: 'available',
      stripeSessionId: null,
    },
  ];
         

export default function BookingPage({ params }: { params: { lang: string } }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const currentLang = params.lang || 'fr';

  const handleError = (msg: string) => {
    toast.error("Une erreur est survenue", {
      description: msg,
      duration: 5000,
    });
    setIsProcessing(false);
  };

  const handleCheckout = async (
    slots: { slotId: string; categoryId: string }[]
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
          slotsToReserve: slots,
          userId: user.uid,
          userEmail: user.email,
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
    slots: { slotId: string; categoryId: string }[]
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
          slotsToReserve: slots,
          userId: user.uid,
          userEmail: user.email,
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

  const registrationClosed =
    Date.now() > MOCK_EVENT.registrationDeadline.toMillis();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Chargement...
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
        availableSlots={MOCK_SLOTS}
        categories={MOCK_CATEGORIES}
        settings={MOCK_EVENT}
        products={MOCK_PRODUCTS.filter(p => p.isActive)}
        registrationClosed={registrationClosed}
        onCheckout={handleCheckout}
        onPackCheckout={handlePackCheckout}
      />
    </div>
  );
}
