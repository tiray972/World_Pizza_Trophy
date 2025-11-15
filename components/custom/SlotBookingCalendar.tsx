// /components/custom/SlotBookingCalendar.tsx

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slot, Category } from '@/types/firestore';
import { Badge } from '@/components/ui/badge';

// --- Types pour ce composant ---
interface SelectedSlot {
    slotId: string;
    categoryId: string;
    categoryName: string;
    startTime: Date;
}

interface SlotBookingCalendarProps {
    // Les slots disponibles pour les deux jours
    availableSlots: Slot[]; 
    // La liste des catégories pour l'affichage
    categories: Category[]; 
    // Fonction à appeler pour lancer le checkout
    onCheckout: (slots: SelectedSlot[]) => void;
}

// Fonction utilitaire (simulée pour l'instant)
const getCategoryName = (categoryId: string, categories: Category[]) => {
    return categories.find(c => c.id === categoryId)?.name || 'Catégorie inconnue';
};

const formatTime = (date: Date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// --- Composant d'affichage d'un seul créneau ---
const SlotItem = ({ slot, isSelected, onToggleSelect, categories }: { slot: Slot, isSelected: boolean, onToggleSelect: (slot: Slot) => void, categories: Category[] }) => {
    const categoryName = getCategoryName(slot.categoryId, categories);
    
    // Le statut est 'paid' ou 'reserved' si un userId est présent
    const isBooked = !!slot.userId && slot.status !== 'available';
    
    // Convertir les Timestamp Firestore en Date (à adapter si vous lisez les données différemment)
    const startTime = slot.startTime instanceof Date ? slot.startTime : (slot.startTime as any).toDate();

    return (
        <Button
            variant={isSelected ? 'default' : 'outline'}
            className={`w-full justify-between mb-2 transition-colors ${isBooked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
            onClick={() => !isBooked && onToggleSelect(slot)}
            disabled={isBooked}
        >
            <div className="flex flex-col items-start">
                <span className="font-semibold">{formatTime(startTime)}</span>
                <span className="text-xs font-normal">{categoryName}</span>
            </div>
            {isBooked && <Badge variant="secondary">Pris</Badge>}
            {isSelected && <Badge variant="default">Sélectionné</Badge>}
        </Button>
    );
};

// --- Composant Principal du Calendrier ---
export function SlotBookingCalendar({ availableSlots, categories, onCheckout }: SlotBookingCalendarProps) {
    const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
    
    // 1. Filtrer les slots par jour
    const day1Slots = availableSlots.filter(slot => (slot as any).day === 1).sort((a, b) => (a.startTime as any).seconds - (b.startTime as any).seconds);
    const day2Slots = availableSlots.filter(slot => (slot as any).day === 2).sort((a, b) => (a.startTime as any).seconds - (b.startTime as any).seconds);

    // 2. Gérer l'ajout/retrait d'un slot du panier
    const handleToggleSelect = (slot: Slot) => {
        const isCurrentlySelected = selectedSlots.some(s => s.slotId === slot.id);

        if (isCurrentlySelected) {
            setSelectedSlots(selectedSlots.filter(s => s.slotId !== slot.id));
        } else {
            const startTime = slot.startTime instanceof Date ? slot.startTime : (slot.startTime as any).toDate();

            const newSlot: SelectedSlot = {
                slotId: slot.id,
                categoryId: slot.categoryId,
                categoryName: getCategoryName(slot.categoryId, categories),
                startTime: startTime,
            };
            setSelectedSlots([...selectedSlots, newSlot]);
        }
    };
    
    // 3. Afficher le total et le bouton de checkout
    const totalSlots = selectedSlots.length;
    const checkoutDisabled = totalSlots === 0;

    const handleCheckout = () => {
        if (!checkoutDisabled) {
            onCheckout(selectedSlots);
        }
    };

    const renderDayColumn = (dayNumber: number, slots: Slot[]) => (
        <Card className="flex-1 min-w-[300px]">
            <CardHeader>
                <CardTitle className="text-xl">Jour {dayNumber}</CardTitle>
                <p className="text-sm text-gray-500">
                    {dayNumber === 1 ? "Samedi de la compétition" : "Dimanche de la compétition"}
                </p>
            </CardHeader>
            <CardContent>
                {slots.length === 0 && <p className="text-sm text-gray-400">Aucun créneau disponible pour ce jour.</p>}
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                    {slots.map(slot => (
                        <SlotItem
                            key={slot.id}
                            slot={slot}
                            isSelected={selectedSlots.some(s => s.slotId === slot.id)}
                            onToggleSelect={handleToggleSelect}
                            categories={categories}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="flex flex-col gap-8">
            <h2 className="text-3xl font-bold tracking-tight">Réserver vos créneaux</h2>
            
            {/* Colonnes Jour 1 et Jour 2 */}
            <div className="flex flex-wrap gap-4">
                {renderDayColumn(1, day1Slots)}
                {renderDayColumn(2, day2Slots)}
            </div>

            {/* Panier et Checkout */}
            <Card className="p-4 bg-primary/5 border-primary">
                <CardTitle className="text-lg mb-2">🛒 Panier ({totalSlots} créneau(x))</CardTitle>
                <CardContent className="p-0 space-y-2">
                    {selectedSlots.map(slot => (
                        <div key={slot.slotId} className="flex justify-between text-sm">
                            <span>{slot.categoryName} - {formatTime(slot.startTime)} (Jour {slot.startTime.getDate() === (day1Slots[0]?.startTime as any).toDate().getDate() ? 1 : 2})</span>
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                className="h-6"
                                onClick={() => handleToggleSelect(availableSlots.find(s => s.id === slot.slotId)!)}
                            >
                                Retirer
                            </Button>
                        </div>
                    ))}
                    <div className="pt-4 border-t mt-4">
                        <Button
                            onClick={handleCheckout}
                            disabled={checkoutDisabled}
                            className="w-full"
                        >
                            {checkoutDisabled ? 'Sélectionnez vos créneaux' : `Passer au paiement pour ${totalSlots} créneau(x)`}
                        </Button>
                        <p className="text-xs text-center mt-2 text-gray-600">
                            **Important :** Vous serez dirigé vers Stripe pour finaliser votre achat.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Pour utiliser ce composant, vous devez le placer dans une page.
// Par exemple: /app/booking/page.tsx