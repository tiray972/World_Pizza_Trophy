// app/[Lang]/booking/page.tsx
'use client';

import { SlotBookingView } from "@/components/custom/SlotBookingCalendar";
import { Slot, Category, Settings } from "@/types/firestore";
import { Timestamp } from "firebase/firestore";

// --- MOCKUP DE DONNÉES DYNAMIQUES (À REMPLACER PAR LA VRAIE LECTURE FIRESTORE) ---

// Dates pour l'année 2026
const EVENT_YEAR = 2026;
const regDeadline = new Date(EVENT_YEAR, 10, 15); // 15 novembre
const day1 = new Date(EVENT_YEAR, 10, 28, 10, 0, 0); // 28 novembre
const day2 = new Date(EVENT_YEAR, 10, 29, 9, 0, 0); // 29 novembre

const MOCK_SETTINGS: Settings = {
    id: 'config',
    eventStartDate: Timestamp.fromDate(day1),
    eventEndDate: Timestamp.fromDate(day2),
    registrationDeadline: Timestamp.fromDate(regDeadline),
    eventYear: EVENT_YEAR,
};

// 12 Catégories avec leurs jours actifs
const MOCK_CATEGORIES: Category[] = [
    { id: 'cat_classique', name: 'Pizza Classique', description: 'La tradition revisitée.', unitPrice: 12000, maxSlots: 60, durationMinutes: 10, activeDays: [1, 2] },
    { id: 'cat_calzone', name: 'Calzone', description: 'Le classique replié.', unitPrice: 10000, maxSlots: 30, durationMinutes: 10, activeDays: [1, 2] },
    { id: 'cat_dessert', name: 'Pizza Dessert', description: 'Sucrée et créative.', unitPrice: 15000, maxSlots: 30, durationMinutes: 10, activeDays: [1, 2] },
    
    { id: 'cat_napo', name: 'Napolitaine (Vera Pizza)', description: 'La vraie napolitaine.', unitPrice: 18000, maxSlots: 20, durationMinutes: 10, activeDays: [1] },
    { id: 'cat_focaccia', name: 'Focaccia', description: 'Pain plat huile d\'olive.', unitPrice: 8000, maxSlots: 15, durationMinutes: 10, activeDays: [1] },
    { id: 'cat_due', name: 'Pizza Due', description: 'Concours en duo.', unitPrice: 20000, maxSlots: 10, durationMinutes: 15, activeDays: [1] },

    { id: 'cat_teglia', name: 'Pizza in Teglia', description: 'Dans la plaque, romaine.', unitPrice: 15000, maxSlots: 25, durationMinutes: 10, activeDays: [2] },
    { id: 'cat_pala', name: 'Pizza alla Pala', description: 'Longue et croustillante.', unitPrice: 15000, maxSlots: 25, durationMinutes: 10, activeDays: [2] },
    { id: 'cat_pasta', name: 'Préparation Pasta', description: 'Épreuve de pâte.', unitPrice: 10000, maxSlots: 15, durationMinutes: 5, activeDays: [2] },

    { id: 'cat_acrobatie', name: 'Acrobatie', description: 'Jonglage de pâte.', unitPrice: 15000, maxSlots: 15, durationMinutes: 5, activeDays: [1, 2] },
    { id: 'cat_free', name: 'Free Style', description: 'Création libre.', unitPrice: 12000, maxSlots: 20, durationMinutes: 10, activeDays: [1] },
    { id: 'cat_gluten', name: 'Sans Gluten', description: 'Spécialité sans gluten.', unitPrice: 14000, maxSlots: 10, durationMinutes: 10, activeDays: [2] },
];

const MOCK_SLOTS: Slot[] = [
    // Simuler des slots variés pour les différents jours/catégories
    { id: 's1', categoryId: 'cat_classique', day: 1 as 1, startTime: Timestamp.fromDate(new Date(day1.setHours(10, 0, 0, 0))), endTime: Timestamp.fromDate(new Date(day1.setHours(10, 10, 0, 0))), userId: null, status: 'available', stripeSessionId: null },
    { id: 's2', categoryId: 'cat_classique', day: 2 as 2, startTime: Timestamp.fromDate(new Date(day2.setHours(9, 30, 0, 0))), endTime: Timestamp.fromDate(new Date(day2.setHours(9, 40, 0, 0))), userId: null, status: 'available', stripeSessionId: null },
    { id: 's3', categoryId: 'cat_napo', day: 1 as 1, startTime: Timestamp.fromDate(new Date(day1.setHours(14, 0, 0, 0))), endTime: Timestamp.fromDate(new Date(day1.setHours(14, 10, 0, 0))), userId: 'user123', status: 'paid', stripeSessionId: 'ses_paid1' }, // Pris
    { id: 's4', categoryId: 'cat_teglia', day: 2 as 2, startTime: Timestamp.fromDate(new Date(day2.setHours(11, 0, 0, 0))), endTime: Timestamp.fromDate(new Date(day2.setHours(11, 10, 0, 0))), userId: null, status: 'available', stripeSessionId: null },
    { id: 's5', categoryId: 'cat_acrobatie', day: 1 as 1, startTime: Timestamp.fromDate(new Date(day1.setHours(15, 0, 0, 0))), endTime: Timestamp.fromDate(new Date(day1.setHours(15, 5, 0, 0))), userId: null, status: 'available', stripeSessionId: null },
];
// --- FIN DU MOCKUP ---

const handleCheckout = (slots: { slotId: string, categoryId: string }[]) => {
    console.log("Slots sélectionnés pour le checkout :", slots);
    // ⚠️ CETTE LOGIQUE SERA DÉVELOPPÉE DANS LE SPRINT 4 ⚠️
    alert(`Checkout lancé pour ${slots.length} créneaux. Le locking des slots et l'appel Stripe se feront au Sprint 4.`);
};

export default function BookingPage() {
    // 💡 REMPLACER par une fonction asynchrone pour charger les slots, catégories et settings depuis Firestore
    // const { availableSlots, categories, settings } = await fetchData(); 
    
    const settings = MOCK_SETTINGS;
    const availableSlots = MOCK_SLOTS;
    const categories = MOCK_CATEGORIES;

    // Logique de vérification de la date limite
    const registrationClosed = Date.now() > settings.registrationDeadline.toMillis();
    
    return (
        <div className="container mx-auto py-10">
            <SlotBookingView 
                availableSlots={availableSlots as any} 
                categories={categories as any}
                settings={settings}
                registrationClosed={registrationClosed}
                onCheckout={handleCheckout} 
            />
        </div>
    );
}
