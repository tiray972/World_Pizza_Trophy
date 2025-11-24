'use client';

import { SlotBookingView } from "@/components/custom/SlotBookingCalendar";
import { Slot, Category, Settings, Product } from "@/types/firestore";
import { Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// --- MOCKUP DE DONNÉES ---
const EVENT_YEAR = 2026;
const regDeadline = new Date(EVENT_YEAR, 10, 15); 
const day1 = new Date(EVENT_YEAR, 10, 28, 10, 0, 0); 
const day2 = new Date(EVENT_YEAR, 10, 29, 9, 0, 0); 

const MOCK_SETTINGS: Settings = {
    id: 'config',
    eventStartDate: Timestamp.fromDate(day1),
    eventEndDate: Timestamp.fromDate(day2),
    registrationDeadline: Timestamp.fromDate(regDeadline),
    eventYear: EVENT_YEAR,
};

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

const MOCK_PRODUCTS: Product[] = [
    {
        id: 'pack_gold',
        name: 'Pack Compétiteur OR',
        description: '3 Catégories + Repas VIP. Accès prioritaire.',
        stripePriceId: 'price_gold_xyz', 
        unitAmount: 30000,
        slotsRequired: 3,
        isPack: true,
        includesMeal: true,
        isActive: true,
    },
    {
        id: 'pack_duo_limit',
        name: 'Pack Duo Limité',
        description: '2 Catégories pour 2 personnes.',
        stripePriceId: 'price_duo_abc', 
        unitAmount: 18000,
        slotsRequired: 2,
        isPack: true,
        includesMeal: false,
        isActive: true,
    },
];

const MOCK_SLOTS: Slot[] = [
    { id: 's1', categoryId: 'cat_classique', day: 1 as 1, startTime: Timestamp.fromDate(new Date(day1.setHours(10, 0, 0, 0))), endTime: Timestamp.fromDate(new Date(day1.setHours(10, 10, 0, 0))), userId: null, status: 'available', stripeSessionId: null },
    { id: 's2', categoryId: 'cat_classique', day: 2 as 2, startTime: Timestamp.fromDate(new Date(day2.setHours(9, 30, 0, 0))), endTime: Timestamp.fromDate(new Date(day2.setHours(9, 40, 0, 0))), userId: null, status: 'available', stripeSessionId: null },
    { id: 's3', categoryId: 'cat_napo', day: 1 as 1, startTime: Timestamp.fromDate(new Date(day1.setHours(14, 0, 0, 0))), endTime: Timestamp.fromDate(new Date(day1.setHours(14, 10, 0, 0))), userId: 'user123', status: 'paid', stripeSessionId: 'ses_paid1' },
    { id: 's4', categoryId: 'cat_teglia', day: 2 as 2, startTime: Timestamp.fromDate(new Date(day2.setHours(11, 0, 0, 0))), endTime: Timestamp.fromDate(new Date(day2.setHours(11, 10, 0, 0))), userId: null, status: 'available', stripeSessionId: null },
    { id: 's5', categoryId: 'cat_acrobatie', day: 1 as 1, startTime: Timestamp.fromDate(new Date(day1.setHours(15, 0, 0, 0))), endTime: Timestamp.fromDate(new Date(day1.setHours(15, 5, 0, 0))), userId: null, status: 'available', stripeSessionId: null },
];

// FIX: Ajout de params pour récupérer la langue actuelle
export default function BookingPage({ params }: { params: { lang: string } }) {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Récupérer la langue actuelle pour les redirections
    const currentLang = params.lang || 'fr'; // Fallback au cas où

    // 1. Écouter l'état de l'authentification
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- FONCTION GESTION ERREUR ---
    const handleError = (msg: string) => {
        toast.error("Une erreur est survenue", {
            description: msg,
            duration: 5000,
        });
        setIsProcessing(false);
    };

    // --- API CALL: CHECKOUT CLASSIQUE ---
    const handleCheckout = async (slots: { slotId: string, categoryId: string }[]) => {
        if (!currentUser) {
            const loginUrl = `/${currentLang}/auth/login?redirect=/${currentLang}/booking`;
            
            toast.info("Connexion requise", {
                description: "Vous devez être connecté pour réserver des créneaux.",
                action: {
                    label: "Se connecter",
                    onClick: () => router.push(loginUrl),
                }
            });
            // Redirection automatique si le toast n'est pas cliqué
            router.push(loginUrl); 
            return;
        }

        setIsProcessing(true);
        toast.loading("Préparation du paiement...", { id: "checkout-loading" });

        try {
            const response = await fetch('/api/booking/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slotsToReserve: slots,
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                }),
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || "Erreur lors du paiement");

            toast.dismiss("checkout-loading");
            toast.success("Redirection vers Stripe...");
            
            // Redirection vers Stripe
            if (data.url) window.location.href = data.url;

        } catch (error: any) {
            toast.dismiss("checkout-loading");
            handleError(error.message);
        }
    };

    // --- API CALL: CHECKOUT PACK ---
    const handlePackCheckout = async (product: Product, slots: { slotId: string, categoryId: string }[]) => {
        if (!currentUser) {
            const loginUrl = `/${currentLang}/auth/login?redirect=/${currentLang}/booking`;

            toast.info("Connexion requise", {
                description: "Vous devez être connecté pour acheter un pack.",
                action: {
                    label: "Se connecter",
                    onClick: () => router.push(loginUrl),
                }
            });
            router.push(loginUrl);
            return;
        }

        setIsProcessing(true);
        toast.loading("Configuration de votre pack...", { id: "pack-loading" });

        try {
            const response = await fetch('/api/booking/checkout-pack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productStripePriceId: product.stripePriceId,
                    slotsToReserve: slots, 
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                }),
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || "Erreur lors de l'achat du pack");

            toast.dismiss("pack-loading");
            toast.success("Pack validé, redirection vers le paiement...");

            // Redirection vers Stripe
            if (data.url) window.location.href = data.url;

        } catch (error: any) {
            toast.dismiss("pack-loading");
            handleError(error.message);
        }
    };

    // Données simulées (Mock)
    const settings = MOCK_SETTINGS;
    const availableSlots = MOCK_SLOTS;
    const categories = MOCK_CATEGORIES;
    const products = MOCK_PRODUCTS.filter(p => p.isActive); 

    const registrationClosed = Date.now() > settings.registrationDeadline.toMillis();
    
    if (loading) return <div className="flex justify-center items-center h-screen">Chargement...</div>;

    return (
        <div className={`container mx-auto py-10 ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
            <SlotBookingView 
                availableSlots={availableSlots as any} 
                categories={categories as any}
                settings={settings}
                products={products as any}
                registrationClosed={registrationClosed}
                onCheckout={handleCheckout} 
                onPackCheckout={handlePackCheckout as any}
            />
            {/* L'état de chargement est maintenant géré visuellement par Sonner Toast, 
                mais on garde le blocage d'UI pour éviter les doubles clics */}
        </div>
    );
}