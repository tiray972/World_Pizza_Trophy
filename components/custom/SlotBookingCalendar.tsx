// components/custom/SlotBookingCalendar.tsx
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slot, Category, Settings } from '@/types/firestore';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ShoppingCartIcon, XCircleIcon, ClockIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// --- Types Locaux ---
interface SelectedSlot {
    slotId: string;
    categoryId: string;
    categoryName: string;
    startTime: Date;
    day: 1 | 2;
}

interface SlotBookingViewProps {
    availableSlots: Slot[];
    categories: Category[];
    settings: Settings;
    registrationClosed: boolean;
    onCheckout: (slots: SelectedSlot[]) => void;
}

// --- Fonctions Utilitaires ---
const formatTime = (date: Date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const formatDate = (timestamp: any) => timestamp instanceof Date ? timestamp.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : (timestamp.toDate() as Date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const getCategoryName = (categoryId: string, categories: Category[]) => categories.find(c => c.id === categoryId)?.name || 'Catégorie inconnue';

// --- Composant Principal de la Vue de Réservation ---
export function SlotBookingView({ availableSlots, categories, settings, registrationClosed, onCheckout }: SlotBookingViewProps) {
    const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [activeDay, setActiveDay] = useState<'1' | '2'>('1');

    // 1. Dériver les dates réelles du concours (pour l'affichage)
    const day1Date = formatDate(settings.eventStartDate);
    const day2Date = formatDate(settings.eventEndDate);

    // 2. Trouver la catégorie actuellement sélectionnée
    const activeCategory = useMemo(() => {
        if (!activeCategoryId) return null;
        return categories.find(c => c.id === activeCategoryId) || null;
    }, [activeCategoryId, categories]);

    // 3. Filtrer les slots affichables (pour la liste détaillée)
    const filteredSlots = useMemo(() => {
        if (!activeCategory) return [];

        return availableSlots
            .filter(slot => slot.categoryId === activeCategoryId && slot.day.toString() === activeDay)
            .sort((a, b) => (a.startTime as any).seconds - (b.startTime as any).seconds);
    }, [availableSlots, activeCategoryId, activeDay, activeCategory]);

    // 4. Gérer l'ajout/retrait d'un slot du panier
    const handleToggleSelect = (slot: Slot) => {
        const isCurrentlySelected = selectedSlots.some(s => s.slotId === slot.id);
        const startTime = slot.startTime instanceof Date ? slot.startTime : (slot.startTime as any).toDate();

        if (isCurrentlySelected) {
            setSelectedSlots(selectedSlots.filter(s => s.slotId !== slot.id));
        } else {
            // Vérification simple (peut être déplacée vers un modal si besoin de détails)
            const newSlot: SelectedSlot = {
                slotId: slot.id,
                categoryId: slot.categoryId,
                categoryName: getCategoryName(slot.categoryId, categories),
                startTime: startTime,
                day: slot.day,
            };
            setSelectedSlots([...selectedSlots, newSlot]);
        }
    };

    // 5. Rendu des cartes de catégories
    const renderCategoryCards = () => (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.map(category => {
                const isSelected = activeCategoryId === category.id;
                const days = category.activeDays.join(' & ');
                const isActiveOnDay1 = category.activeDays.includes(1);
                const isActiveOnDay2 = category.activeDays.includes(2);

                return (
                    <Card
                        key={category.id}
                        className={`cursor-pointer transition-all hover:shadow-lg ${isSelected ? 'border-2 border-primary shadow-lg' : 'border-gray-200'}`}
                        onClick={() => {
                            setActiveCategoryId(category.id);
                            // Définir le jour actif par défaut si la catégorie est sélectionnée
                            if (!activeCategoryId || activeCategoryId !== category.id) {
                                setActiveDay(isActiveOnDay1 ? '1' : '2'); 
                            }
                        }}
                    >
                        <CardHeader className="p-3">
                            <CardTitle className="text-base truncate">{category.name}</CardTitle>
                            <CardDescription className="text-xs">
                                {category.description.substring(0, 30)}...
                            </CardDescription>
                        </CardHeader>
                        <CardFooter className="p-3 pt-0">
                            <Badge variant="secondary" className="text-xs">
                                <CalendarIcon className="w-3 h-3 mr-1" />
                                Jours: {days}
                            </Badge>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>
    );

    // 6. Rendu des slots détaillés pour la catégorie active
    const renderSlotDetails = () => {
        if (!activeCategory) {
            return (
                <Card className="p-6 text-center bg-gray-50 border-dashed border-gray-300">
                    <p className="text-gray-500">Sélectionnez une catégorie ci-dessus pour voir les créneaux disponibles.</p>
                </Card>
            );
        }

        const isDay1Active = activeCategory.activeDays.includes(1);
        const isDay2Active = activeCategory.activeDays.includes(2);

        return (
            <Card className="mt-6 p-4">
                <Tabs value={activeDay} onValueChange={(value) => setActiveDay(value as '1' | '2')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="1" disabled={!isDay1Active}>
                            Jour 1 ({day1Date})
                        </TabsTrigger>
                        <TabsTrigger value="2" disabled={!isDay2Active}>
                            Jour 2 ({day2Date})
                        </TabsTrigger>
                    </TabsList>

                    <div className="mt-4 max-h-[400px] overflow-y-auto pr-2">
                        <TabsContent value={activeDay}>
                            {filteredSlots.length > 0 ? (
                                <div className="space-y-2">
                                    {filteredSlots.map(slot => {
                                        const isBooked = !!slot.userId && slot.status !== 'available';
                                        const isSelected = selectedSlots.some(s => s.slotId === slot.id);
                                        const time = slot.startTime instanceof Date ? slot.startTime : (slot.startTime as any).toDate();

                                        return (
                                            <Button
                                                key={slot.id}
                                                variant={isSelected ? 'default' : 'outline'}
                                                className={`w-full justify-between transition-colors ${isBooked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                                onClick={() => !isBooked && !registrationClosed && handleToggleSelect(slot)}
                                                disabled={isBooked || registrationClosed}
                                            >
                                                <div className="flex items-center">
                                                    <ClockIcon className="w-4 h-4 mr-2" />
                                                    <span className="font-semibold">{formatTime(time)}</span>
                                                </div>
                                                {isBooked && <Badge variant="secondary">Pris</Badge>}
                                                {isSelected && <Badge variant="default">Sélectionné</Badge>}
                                                {registrationClosed && !isBooked && <Badge variant="destructive">Fermé</Badge>}
                                            </Button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-center text-sm text-gray-500">
                                    {isDay1Active || isDay2Active ? "Aucun créneau libre pour ce jour et cette catégorie." : "Cette catégorie n'est pas active ce jour-là."}
                                </p>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </Card>
        );
    };

    return (
        <div className="flex flex-col gap-8">
            <h2 className="text-3xl font-bold tracking-tight">Réserver vos créneaux pour {settings.eventYear}</h2>

            {/* Message de fermeture d'inscription */}
            {registrationClosed && (
                <Card className="p-4 bg-red-100 border-red-500">
                    <p className="font-semibold text-red-700 flex items-center">
                        <XCircleIcon className="w-5 h-5 mr-2" />
                        Les inscriptions sont fermées depuis le {formatDate(settings.registrationDeadline)}.
                    </p>
                </Card>
            )}

            <p className="text-lg text-gray-600">
                1. Sélectionnez une ou plusieurs catégories ci-dessous pour voir les créneaux par jour (Jour 1: {day1Date}, Jour 2: {day2Date}).
            </p>

            {/* Rendu de la grille des catégories */}
            {renderCategoryCards()}

            {/* Rendu des détails du jour/slot */}
            {renderSlotDetails()}

            {/* Panier et Checkout (Fixé en bas de la page pour le mobile) */}
            <Card className="p-4 bg-primary/5 border-primary sticky bottom-0 z-10 mt-6">
                <CardTitle className="text-lg mb-2 flex items-center">
                    <ShoppingCartIcon className="w-5 h-5 mr-2" />
                    🛒 Panier ({selectedSlots.length} créneau(x))
                </CardTitle>
                <CardContent className="p-0 space-y-2">
                    {selectedSlots.map(slot => (
                        <div key={slot.slotId} className="flex justify-between text-sm items-center">
                            <span>{slot.categoryName} ({formatTime(slot.startTime)} - Jour {slot.day})</span>
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
                            onClick={() => onCheckout(selectedSlots)}
                            disabled={selectedSlots.length === 0 || registrationClosed}
                            className="w-full"
                        >
                            {registrationClosed ? 'Inscription Fermée' : selectedSlots.length === 0 ? 'Sélectionnez vos créneaux' : `Passer au paiement pour ${selectedSlots.length} créneau(x)`}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
