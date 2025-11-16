'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slot, Category, Settings } from '@/types/firestore';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ShoppingCartIcon, XCircleIcon, ClockIcon, PizzaIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';

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
// Adjusted formatDate to handle both Timestamp object structure and Date objects from mocks
const formatDate = (timestamp: any) => {
    if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    }
    // Assumes firebase Timestamp structure for non-Date objects
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    }
    return '';
};
const getCategoryName = (categoryId: string, categories: Category[]) => categories.find(c => c.id === categoryId)?.name || 'Catégorie inconnue';

// --- Composant Principal de la Vue de Réservation ---
export function SlotBookingView({ availableSlots, categories, settings, registrationClosed, onCheckout }: SlotBookingViewProps) {
    const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
    
    // State pour la Sheet de sélection des créneaux
    const [isSlotSheetOpen, setIsSlotSheetOpen] = useState(false);
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [activeDay, setActiveDay] = useState<'1' | '2'>('1');

    // State pour la Sheet du panier
    const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);

    // 1. Dériver les dates réelles du concours (pour l'affichage)
    const day1Date = useMemo(() => formatDate(settings.eventStartDate), [settings.eventStartDate]);
    const day2Date = useMemo(() => formatDate(settings.eventEndDate), [settings.eventEndDate]);

    // 2. Trouver la catégorie actuellement sélectionnée pour la Sheet
    const activeCategory = useMemo(() => {
        if (!activeCategoryId) return null;
        return categories.find(c => c.id === activeCategoryId) || null;
    }, [activeCategoryId, categories]);

    // 3. Filtrer les slots affichables dans la Sheet
    const filteredSlots = useMemo(() => {
        if (!activeCategory) return [];

        return availableSlots
            .filter(slot => slot.categoryId === activeCategoryId && slot.day.toString() === activeDay && slot.status === 'available')
            .sort((a, b) => {
                const timeA = a.startTime instanceof Date ? a.startTime.getTime() : (a.startTime as any).seconds;
                const timeB = b.startTime instanceof Date ? b.startTime.getTime() : (b.startTime as any).seconds;
                return timeA - timeB;
            });
    }, [availableSlots, activeCategoryId, activeDay, activeCategory]);


    // 4. Gérer l'ouverture du Sheet de sélection des slots
    const handleCategoryClick = (category: Category) => {
        setActiveCategoryId(category.id);
        // Définir le jour actif par défaut (le premier jour actif)
        setActiveDay(category.activeDays.includes(1) ? '1' : '2'); 
        setIsSlotSheetOpen(true);
    };

    // 5. Gérer l'ajout/retrait d'un slot du panier
    const handleToggleSelect = (slot: Slot) => {
        const isCurrentlySelected = selectedSlots.some(s => s.slotId === slot.id);
        const startTime = slot.startTime instanceof Date ? slot.startTime : (slot.startTime as any).toDate();

        if (isCurrentlySelected) {
            setSelectedSlots(selectedSlots.filter(s => s.slotId !== slot.id));
        } else {
            const newSlot: SelectedSlot = {
                slotId: slot.id,
                categoryId: slot.categoryId,
                categoryName: getCategoryName(slot.categoryId, categories),
                startTime: startTime,
                day: slot.day,
            };
            setSelectedSlots([...selectedSlots, newSlot]);
            
            // Fermer le sheet après avoir sélectionné un slot (pour mobile)
            // On peut aussi choisir de laisser ouvert pour une sélection multiple rapide, 
            // mais l'utilisateur a demandé la validation "on fait OK. Ça valide le slot choisi."
            // Ici, on valide l'ajout au panier. La validation finale est le checkout.
        }
    };
    
    // 6. Rendu des cartes de catégories
    const renderCategoryCards = () => (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.map(category => {
                const days = category.activeDays.join(' & ');
                
                return (
                    <Card
                        key={category.id}
                        className={`cursor-pointer transition-all hover:shadow-lg hover:border-primary border-gray-200 ${registrationClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => !registrationClosed && handleCategoryClick(category)}
                    >
                        <CardHeader className="p-3">
                            <CardTitle className="text-base truncate flex items-center">
                                <PizzaIcon className="w-4 h-4 mr-1 text-primary"/>
                                {category.name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                                {category.description.substring(0, 30)}{category.description.length > 30 ? '...' : ''}
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

    // 7. Rendu du contenu de la Sheet de sélection des slots
    const renderSlotSheetContent = () => {
        if (!activeCategory) return null;

        const isDay1Active = activeCategory.activeDays.includes(1);
        const isDay2Active = activeCategory.activeDays.includes(2);

        return (
            <SheetContent side="bottom" className="sm:max-w-xl h-[90vh] flex flex-col">
                <SheetHeader>
                    <SheetTitle>{activeCategory.name}</SheetTitle>
                    <SheetDescription>
                        Sélectionnez vos créneaux horaires pour cette catégorie.
                    </SheetDescription>
                </SheetHeader>

                {/* Utilisation correcte des Tabs englobant TabsList et TabsContent */}
                <Tabs value={activeDay} onValueChange={(value) => setActiveDay(value as '1' | '2')} className="w-full flex-grow flex flex-col">
                    <TabsList className="grid w-full grid-cols-2 flex-shrink-0 mb-4">
                        <TabsTrigger value="1" disabled={!isDay1Active}>
                            Jour 1 ({day1Date})
                        </TabsTrigger>
                        <TabsTrigger value="2" disabled={!isDay2Active}>
                            Jour 2 ({day2Date})
                        </TabsTrigger>
                    </TabsList>

                    {/* Contenu des onglets avec défilement vertical */}
                    <div className="flex-grow overflow-y-auto pr-2">
                        <TabsContent value="1" className="mt-0">
                            {activeDay === '1' && (
                                filteredSlots.length > 0 ? (
                                    <div className="space-y-2">
                                        {filteredSlots.map(slot => {
                                            const isSelected = selectedSlots.some(s => s.slotId === slot.id);
                                            const time = slot.startTime instanceof Date ? slot.startTime : (slot.startTime as any).toDate();

                                            return (
                                                <Button
                                                    key={slot.id}
                                                    variant={isSelected ? 'default' : 'outline'}
                                                    className={`w-full justify-start transition-colors`}
                                                    onClick={() => handleToggleSelect(slot)}
                                                >
                                                    <ClockIcon className="w-4 h-4 mr-2" />
                                                    <span className="font-semibold">{formatTime(time)}</span>
                                                    <Badge className={`ml-auto ${isSelected ? 'bg-white text-primary' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
                                                        {isSelected ? 'Retirer' : 'Ajouter'}
                                                    </Badge>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-center text-sm text-gray-500 p-8 border border-dashed rounded-lg">
                                        {isDay1Active ? "Aucun créneau libre pour ce jour et cette catégorie." : "Cette catégorie n'est pas active ce jour-là."}
                                    </p>
                                )
                            )}
                        </TabsContent>
                        <TabsContent value="2" className="mt-0">
                            {activeDay === '2' && (
                                filteredSlots.length > 0 ? (
                                    <div className="space-y-2">
                                        {filteredSlots.map(slot => {
                                            const isSelected = selectedSlots.some(s => s.slotId === slot.id);
                                            const time = slot.startTime instanceof Date ? slot.startTime : (slot.startTime as any).toDate();

                                            return (
                                                <Button
                                                    key={slot.id}
                                                    variant={isSelected ? 'default' : 'outline'}
                                                    className={`w-full justify-start transition-colors`}
                                                    onClick={() => handleToggleSelect(slot)}
                                                >
                                                    <ClockIcon className="w-4 h-4 mr-2" />
                                                    <span className="font-semibold">{formatTime(time)}</span>
                                                    <Badge className={`ml-auto ${isSelected ? 'bg-white text-primary' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
                                                        {isSelected ? 'Retirer' : 'Ajouter'}
                                                    </Badge>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-center text-sm text-gray-500 p-8 border border-dashed rounded-lg">
                                        {isDay2Active ? "Aucun créneau libre pour ce jour et cette catégorie." : "Cette catégorie n'est pas active ce jour-là."}
                                    </p>
                                )
                            )}
                        </TabsContent>
                    </div>
                </Tabs>

                <SheetFooter className="mt-4 flex-shrink-0">
                    <SheetClose asChild>
                        <Button type="button" className="w-full">
                            OK, Créneaux Ajoutés au Panier
                        </Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        );
    };
    
    // 8. Rendu du contenu de la Sheet du panier
    const renderCartSheetContent = () => (
        <SheetContent side="right" className="sm:max-w-lg">
            <SheetHeader>
                <SheetTitle>Votre Panier de Réservation</SheetTitle>
                <SheetDescription>
                    Vérifiez et confirmez les créneaux sélectionnés avant le paiement.
                </SheetDescription>
            </SheetHeader>
            <div className="py-4 space-y-3 max-h-[70vh] overflow-y-auto">
                {selectedSlots.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 border border-dashed rounded-lg">
                        Votre panier est vide. Sélectionnez une catégorie pour commencer.
                    </div>
                ) : (
                    selectedSlots.map(slot => (
                        <Card key={slot.slotId} className="p-3 flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{slot.categoryName}</p>
                                <p className="text-sm text-gray-500">
                                    {formatTime(slot.startTime)} - Jour {slot.day} ({formatDate(settings.eventStartDate.toDate().setDate(settings.eventStartDate.toDate().getDate() + slot.day - 1))})
                                </p>
                            </div>
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                className="h-7 w-7 p-0"
                                onClick={() => handleToggleSelect(availableSlots.find(s => s.id === slot.slotId)!)}
                            >
                                <XCircleIcon className="w-4 h-4" />
                            </Button>
                        </Card>
                    ))
                )}
            </div>
            <SheetFooter className="mt-4">
                <Button
                    onClick={() => {
                        onCheckout(selectedSlots);
                        setIsCartSheetOpen(false);
                    }}
                    disabled={selectedSlots.length === 0 || registrationClosed}
                    className="w-full"
                >
                    {registrationClosed ? 'Inscription Fermée' : selectedSlots.length === 0 ? 'Panier vide' : `Passer au paiement pour ${selectedSlots.length} créneau(x)`}
                </Button>
            </SheetFooter>
        </SheetContent>
    );

    return (
        <div className="container mx-auto py-10 min-h-screen">
            <h1 className="text-4xl font-extrabold tracking-tight mb-8 text-center md:text-left">
                Réserver vos Créneaux Compétition
            </h1>

            {/* Message de fermeture d'inscription */}
            {registrationClosed && (
                <Card className="p-4 bg-red-100 border-l-4 border-red-500 mb-6 shadow-sm">
                    <p className="font-semibold text-red-700 flex items-center">
                        <XCircleIcon className="w-5 h-5 mr-2" />
                        Les inscriptions sont fermées depuis le {formatDate(settings.registrationDeadline)}.
                    </p>
                </Card>
            )}

            <p className="text-xl text-gray-700 mb-8">
                Sélectionnez la catégorie de compétition pour voir et réserver vos créneaux horaires disponibles.
            </p>

            {/* Rendu de la grille des catégories */}
            {renderCategoryCards()}
            
            {/* Panneau (Sheet) de sélection des créneaux (S'ouvre au clic sur une carte) */}
            <Sheet open={isSlotSheetOpen} onOpenChange={setIsSlotSheetOpen}>
                {renderSlotSheetContent()}
            </Sheet>

            {/* Panier Flottant (FAB) */}
            <Button 
                onClick={() => setIsCartSheetOpen(true)}
                className={`fixed bottom-6 right-6 rounded-full w-14 h-14 p-0 shadow-xl z-50 transition-transform duration-300 ${selectedSlots.length > 0 ? 'scale-100' : 'scale-75 opacity-0 pointer-events-none'}`}
                aria-label="Voir le panier de réservation"
                disabled={registrationClosed}
            >
                <ShoppingCartIcon className="w-6 h-6" />
                <Badge className="absolute -top-1 -right-1 bg-red-500 h-5 min-w-5 justify-center p-1 text-xs font-bold">
                    {selectedSlots.length}
                </Badge>
            </Button>

            {/* Panneau (Sheet) du panier (S'ouvre au clic sur le FAB) */}
            <Sheet open={isCartSheetOpen} onOpenChange={setIsCartSheetOpen}>
                {renderCartSheetContent()}
            </Sheet>
        </div>
    );
}
