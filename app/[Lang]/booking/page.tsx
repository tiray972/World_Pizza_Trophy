// /app/booking/page.tsx
// (Ceci est un exemple pour illustrer le composant ci-dessus)

'use client';

import { SlotBookingCalendar } from "@/components/custom/SlotBookingCalendar";
import { Slot, Category } from "@/types/firestore";
import { Timestamp } from "firebase/firestore"; // Assurez-vous d'importer Timestamp

// ⚠️ Simulation de données pour le test
const MOCK_CATEGORIES: Category[] = [
    { id: 'cat_pizza_classique', name: 'Pizza Classique', description: '', maxSlots: 50, durationMinutes: 10 },
    { id: 'cat_pizza_acrobatie', name: 'Pizza Acrobatie', description: '', maxSlots: 20, durationMinutes: 5 },
];

const now = new Date();
const day1Date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7); // Samedi prochain
const day2Date = new Date(day1Date);
day2Date.setDate(day1Date.getDate() + 1); // Dimanche

const MOCK_SLOTS: Slot[] = [
    // Jour 1 (Samedi)
    { id: 's1', categoryId: 'cat_pizza_classique', day: 1 as 1, startTime: Timestamp.fromDate(new Date(day1Date.setHours(10, 0, 0, 0))), endTime: Timestamp.fromDate(new Date(day1Date.setHours(10, 10, 0, 0))), userId: null, status: 'available', stripeSessionId: null },
    { id: 's2', categoryId: 'cat_pizza_classique', day: 1 as 1, startTime: Timestamp.fromDate(new Date(day1Date.setHours(10, 10, 0, 0))), endTime: Timestamp.fromDate(new Date(day1Date.setHours(10, 20, 0, 0))), userId: 'user123', status: 'paid', stripeSessionId: 'ses_paid1' }, // Pris
    { id: 's3', categoryId: 'cat_pizza_acrobatie', day: 1 as 1, startTime: Timestamp.fromDate(new Date(day1Date.setHours(14, 0, 0, 0))), endTime: Timestamp.fromDate(new Date(day1Date.setHours(14, 5, 0, 0))), userId: null, status: 'available', stripeSessionId: null },
    // Jour 2 (Dimanche)
    { id: 's4', categoryId: 'cat_pizza_classique', day: 2 as 2, startTime: Timestamp.fromDate(new Date(day2Date.setHours(9, 0, 0, 0))), endTime: Timestamp.fromDate(new Date(day2Date.setHours(9, 10, 0, 0))), userId: null, status: 'available', stripeSessionId: null },
    { id: 's5', categoryId: 'cat_pizza_acrobatie', day: 2 as 2, startTime: Timestamp.fromDate(new Date(day2Date.setHours(11, 0, 0, 0))), endTime: Timestamp.fromDate(new Date(day2Date.setHours(11, 5, 0, 0))), userId: null, status: 'available', stripeSessionId: null },
];
// ⚠️ Fin de la simulation

const handleCheckout = (slots: { slotId: string, categoryId: string }[]) => {
    console.log("Slots sélectionnés pour le checkout :", slots);
    // Ici, vous appelerez l'API ou la Server Action qui gère le verrouillage transactionnel et la session Stripe.
    // Cette logique sera développée dans le Sprint 4 !
    alert(`Checkout lancé pour ${slots.length} créneaux. Le locking des slots et l'appel Stripe se feront au Sprint 4.`);
};

export default function BookingPage() {
    // 💡 REMPLACER par une fonction asynchrone pour charger les slots disponibles depuis Firestore
    // const availableSlots = await fetchAvailableSlots(); 
    
    return (
        <div className="container mx-auto py-10">
            <SlotBookingCalendar 
                availableSlots={MOCK_SLOTS as any} 
                categories={MOCK_CATEGORIES as any}
                onCheckout={handleCheckout} 
            />
        </div>
    );
}