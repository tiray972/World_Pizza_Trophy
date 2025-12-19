'use client';

import { SlotBookingView } from "@/components/custom/SlotBookingCalendar";
import { Slot, Category, Settings, Product } from "@/types/firestore";
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

export const MOCK_SETTINGS: Settings = {
    id: 'config',
    eventStartDate: Timestamp.fromDate(day1),
    eventEndDate: Timestamp.fromDate(day2),
    registrationDeadline: Timestamp.fromDate(regDeadline),
    eventYear: EVENT_YEAR,
  };
  export const MOCK_CATEGORIES: Category[] = [
    {
      id: 'cat_classique',
      name: 'Pizza Classique',
      description: 'La tradition italienne.',
      unitPrice: 120,
      maxSlots: 60,
      durationMinutes: 10,
      activeDates: [day1ISO, day2ISO],
    },
    {
      id: 'cat_calzone',
      name: 'Calzone',
      description: 'Le classique replié.',
      unitPrice: 100,
      maxSlots: 30,
      durationMinutes: 10,
      activeDates: [day1ISO, day2ISO],
    },
    {
      id: 'cat_dessert',
      name: 'Pizza Dessert',
      description: 'Créations sucrées.',
      unitPrice: 130,
      maxSlots: 30,
      durationMinutes: 10,
      activeDates: [day1ISO, day2ISO],
    },
    {
      id: 'cat_napo',
      name: 'Napolitaine',
      description: 'Vera Pizza Napoletana.',
      unitPrice: 180,
      maxSlots: 20,
      durationMinutes: 10,
      activeDates: [day1ISO],
    },
    {
      id: 'cat_focaccia',
      name: 'Focaccia',
      description: 'Pain plat à l’huile d’olive.',
      unitPrice: 80,
      maxSlots: 20,
      durationMinutes: 10,
      activeDates: [day2ISO],
    },
    {
      id: 'cat_pasta',
      name: 'Pasta',
      description: 'Travail de la pâte.',
      unitPrice: 90,
      maxSlots: 20,
      durationMinutes: 5,
      activeDates: [day1ISO],
    },
    {
      id: 'cat_due',
      name: 'Pizza Douée',
      description: 'Compétition en duo.',
      unitPrice: 200,
      maxSlots: 10,
      durationMinutes: 15,
      activeDates: [day2ISO],
    },
    {
      id: 'cat_rapidite',
      name: 'Rapidité',
      description: 'Vitesse et précision.',
      unitPrice: 110,
      maxSlots: 20,
      durationMinutes: 5,
      activeDates: [day2ISO],
    },
    {
      id: 'cat_freestyle',
      name: 'Freestyle',
      description: 'Créativité totale.',
      unitPrice: 140,
      maxSlots: 20,
      durationMinutes: 10,
      activeDates: [day2ISO],
    },
    {
      id: 'cat_large',
      name: 'Large',
      description: 'Pizza grand format.',
      unitPrice: 150,
      maxSlots: 20,
      durationMinutes: 10,
      activeDates: [day2ISO],
    },
    {
      id: 'cat_teglia',
      name: 'Teglia',
      description: 'Pizza en plaque.',
      unitPrice: 150,
      maxSlots: 25,
      durationMinutes: 10,
      activeDates: [day1ISO],
    },
    {
      id: 'cat_pala',
      name: 'Pala',
      description: 'Pizza alla pala.',
      unitPrice: 150,
      maxSlots: 25,
      durationMinutes: 10,
      activeDates: [day2ISO],
    },
  ];
  export const MOCK_PRODUCTS: Product[] = [
    {
      id: 'pack_gold',
      name: 'Pack Compétiteur OR',
      description: '3 catégories + repas VIP',
      stripePriceId: 'price_gold_xyz',
      unitAmount: 300,
      slotsRequired: 3,
      isPack: true,
      includesMeal: true,
      isActive: true,
    },
    {
      id: 'pack_duo',
      name: 'Pack Duo',
      description: '2 catégories pour 2 personnes',
      stripePriceId: 'price_duo_abc',
      unitAmount: 180,
      slotsRequired: 2,
      isPack: true,
      includesMeal: false,
      isActive: true,
    },
  ];
  export const MOCK_SLOTS: Slot[] = [
    // Classique
    {
      id: 'slot_classique_1',
      categoryId: 'cat_classique',
      date: day1ISO,
      startTime: Timestamp.fromDate(new Date(2025, 10, 4, 10, 0)),
      endTime: Timestamp.fromDate(new Date(2025, 10, 4, 10, 10)),
      status: 'available',
      stripeSessionId: null,
    },
    {
      id: 'slot_classique_2',
      categoryId: 'cat_classique',
      date: day2ISO,
      startTime: Timestamp.fromDate(new Date(2025, 10, 5, 9, 30)),
      endTime: Timestamp.fromDate(new Date(2025, 10, 5, 9, 40)),
      status: 'available',
      stripeSessionId: null,
    },
  
    // Napolitaine
    {
      id: 'slot_napo_1',
      categoryId: 'cat_napo',
      date: day1ISO,
      startTime: Timestamp.fromDate(new Date(2025, 10, 4, 11, 0)),
      endTime: Timestamp.fromDate(new Date(2025, 10, 4, 11, 10)),
      status: 'available',
      stripeSessionId: null,
    },
  
    // Focaccia
    {
      id: 'slot_focaccia_1',
      categoryId: 'cat_focaccia',
      date: day2ISO,
      startTime: Timestamp.fromDate(new Date(2025, 10, 5, 10, 0)),
      endTime: Timestamp.fromDate(new Date(2025, 10, 5, 10, 10)),
      status: 'available',
      stripeSessionId: null,
    },
  
    // Pasta
    {
      id: 'slot_pasta_1',
      categoryId: 'cat_pasta',
      date: day1ISO,
      startTime: Timestamp.fromDate(new Date(2025, 10, 4, 12, 0)),
      endTime: Timestamp.fromDate(new Date(2025, 10, 4, 12, 5)),
      status: 'available',
      stripeSessionId: null,
    },
  
    // Douée
    {
      id: 'slot_due_1',
      categoryId: 'cat_due',
      date: day2ISO,
      startTime: Timestamp.fromDate(new Date(2025, 10, 5, 14, 0)),
      endTime: Timestamp.fromDate(new Date(2025, 10, 5, 14, 15)),
      status: 'available',
      stripeSessionId: null,
    },
  
    // Freestyle
    {
      id: 'slot_freestyle_1',
      categoryId: 'cat_freestyle',
      date: day2ISO,
      startTime: Timestamp.fromDate(new Date(2025, 10, 5, 15, 0)),
      endTime: Timestamp.fromDate(new Date(2025, 10, 5, 15, 10)),
      status: 'available',
      stripeSessionId: null,
    },
  
    // Teglia
    {
      id: 'slot_teglia_1',
      categoryId: 'cat_teglia',
      date: day1ISO,
      startTime: Timestamp.fromDate(new Date(2025, 10, 4, 16, 0)),
      endTime: Timestamp.fromDate(new Date(2025, 10, 4, 16, 10)),
      status: 'available',
      stripeSessionId: null,
    },
  
    // Pala
    {
      id: 'slot_pala_1',
      categoryId: 'cat_pala',
      date: day2ISO,
      startTime: Timestamp.fromDate(new Date(2025, 10, 5, 16, 30)),
      endTime: Timestamp.fromDate(new Date(2025, 10, 5, 16, 40)),
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
    Date.now() > MOCK_SETTINGS.registrationDeadline.toMillis();

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
        settings={MOCK_SETTINGS}
        products={MOCK_PRODUCTS.filter(p => p.isActive)}
        registrationClosed={registrationClosed}
        onCheckout={handleCheckout}
        onPackCheckout={handlePackCheckout}
      />
    </div>
  );
}
