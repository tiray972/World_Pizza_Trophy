'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slot, Category, Settings, Product } from '@/types/firestore'; // Import Product
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ShoppingCartIcon, XCircleIcon, ClockIcon, PizzaIcon, PackageIcon, UtensilsCrossedIcon, CheckCircleIcon, ArrowLeftIcon } from 'lucide-react'; // Import icons
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

// Interface pour les slots d'un pack (temporaire avant paiement)
interface SelectedPackSlot extends SelectedSlot {
    // Aucune propriété supplémentaire pour l'instant
}

interface SlotBookingViewProps {
    availableSlots: Slot[];
    categories: Category[];
    settings: Settings;
    products: Product[]; // NOUVEAU: Liste des produits/packs
    registrationClosed: boolean;
    onCheckout: (slots: SelectedSlot[]) => void;
    // La fonction onPackCheckout est mise à jour pour prendre le pack ET les slots sélectionnés
    onPackCheckout: (product: Product, slots: SelectedPackSlot[]) => void; 
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
const formatPrice = (amount: number) => (amount / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });


// --- Composant Principal de la Vue de Réservation ---
export function SlotBookingView({ availableSlots, categories, settings, products, registrationClosed, onCheckout, onPackCheckout }: SlotBookingViewProps) {
    const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
    
    // State pour la Sheet de sélection des créneaux individuels
    const [isSlotSheetOpen, setIsSlotSheetOpen] = useState(false);
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [activeDay, setActiveDay] = useState<'1' | '2'>('1');

    // State pour la Sheet du panier
    const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);

    // NOUVEAU: State pour la sélection du Pack
    const [isPackSelectionSheetOpen, setIsPackSelectionSheetOpen] = useState(false);
    const [packToPurchase, setPackToPurchase] = useState<Product | null>(null);
    const [selectedPackSlots, setSelectedPackSlots] = useState<SelectedPackSlot[]>([]);
    const [activePackCategoryId, setActivePackCategoryId] = useState<string | null>(null);


    // 1. Dériver les dates réelles du concours (pour l'affichage)
    const day1Date = useMemo(() => formatDate(settings.eventStartDate), [settings.eventStartDate]);
    const day2Date = useMemo(() => formatDate(settings.eventEndDate), [settings.eventEndDate]);

    // 2. Trouver la catégorie actuellement sélectionnée pour la Sheet
    const activeCategory = useMemo(() => {
        const id = isPackSelectionSheetOpen ? activePackCategoryId : activeCategoryId;
        if (!id) return null;
        return categories.find(c => c.id === id) || null;
    }, [activeCategoryId, activePackCategoryId, categories, isPackSelectionSheetOpen]);

    // 3. Filtrer les slots affichables dans la Sheet (pour les deux modes : individuel et pack)
    const filteredSlots = useMemo(() => {
        const currentActiveDay = isPackSelectionSheetOpen ? activeDay : activeDay;
        const currentActiveCategory = isPackSelectionSheetOpen ? activePackCategoryId : activeCategoryId;
        
        if (!currentActiveCategory) return [];

        // Filtrer les slots disponibles ET non déjà sélectionnés dans le panier standard OU dans le pack
        const slotsInStandardCart = new Set(selectedSlots.map(s => s.slotId));
        const slotsInPackSelection = new Set(selectedPackSlots.map(s => s.slotId));

        return availableSlots
            .filter(slot => 
                slot.categoryId === currentActiveCategory && 
                slot.day.toString() === currentActiveDay && 
                slot.status === 'available' &&
                !slotsInStandardCart.has(slot.id) &&
                !slotsInPackSelection.has(slot.id) // Éviter la sélection du même slot dans le panier et le pack
            )
            .sort((a, b) => {
                const timeA = a.startTime instanceof Date ? a.startTime.getTime() : (a.startTime as any).seconds;
                const timeB = b.startTime instanceof Date ? b.startTime.getTime() : (b.startTime as any).seconds;
                return timeA - timeB;
            });
    }, [availableSlots, activeCategoryId, activePackCategoryId, activeDay, selectedSlots, selectedPackSlots, isPackSelectionSheetOpen]);


    // 4. Gérer l'ouverture du Sheet de sélection des slots individuels
    const handleCategoryClick = (category: Category) => {
        setActiveCategoryId(category.id);
        // Définir le jour actif par défaut (le premier jour actif)
        setActiveDay(category.activeDays.includes(1) ? '1' : '2'); 
        setIsSlotSheetOpen(true);
    };
    
    // NOUVEAU: Gérer l'ouverture du Sheet de sélection des packs
    const handlePackSelectionStart = (product: Product) => {
        setPackToPurchase(product);
        setSelectedPackSlots([]); // Réinitialiser la sélection
        setIsPackSelectionSheetOpen(true);
        // On n'initialise pas activePackCategoryId ici, il sera géré dans la Sheet du Pack
    };

    // 5. Gérer l'ajout/retrait d'un slot du panier INDIVIDUEL
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
            // On ferme le sheet seulement si on ajoute un slot pour une sélection simple
            // setIsSlotSheetOpen(false);
        }
    };
    
    // NOUVEAU: Gérer l'ajout/retrait d'un slot pour la sélection de PACK
    const handleTogglePackSlotSelect = (slot: Slot) => {
        if (!packToPurchase) return;

        const isCurrentlySelected = selectedPackSlots.some(s => s.slotId === slot.id);
        const startTime = slot.startTime instanceof Date ? slot.startTime : (slot.startTime as any).toDate();

        if (isCurrentlySelected) {
            setSelectedPackSlots(selectedPackSlots.filter(s => s.slotId !== slot.id));
        } else {
            // Empêcher d'ajouter plus de slots que le pack n'en requiert
            if (selectedPackSlots.length < packToPurchase.slotsRequired) {
                const newSlot: SelectedPackSlot = {
                    slotId: slot.id,
                    categoryId: slot.categoryId,
                    categoryName: getCategoryName(slot.categoryId, categories),
                    startTime: startTime,
                    day: slot.day,
                };
                setSelectedPackSlots([...selectedPackSlots, newSlot]);
            }
        }
    };

    // 6. Rendu des cartes de catégories (Inchangé)
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

    // 7. Rendu des Packs et Produits (Mis à jour pour le nouveau flux)
    const renderProductPacks = () => {
        // Filtrer uniquement les Packs (isPack: true) ou d'autres produits importants
        const activePacks = products.filter(p => p.isPack);
        
        if (activePacks.length === 0) return null;

        return (
            <div className="mb-10 p-4 border-2 border-primary/50 bg-primary/5 rounded-lg shadow-inner">
                <h2 className="text-2xl font-bold mb-4 text-primary flex items-center">
                    <PackageIcon className="w-6 h-6 mr-2" />
                    Offres Spéciales & Packs Compétition
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activePacks.map(product => (
                        <Card 
                            key={product.id} 
                            className={`bg-white shadow-lg transition-transform hover:scale-[1.02] ${registrationClosed ? 'opacity-50' : 'border-primary'}`}
                        >
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-lg flex justify-between items-center">
                                    {product.name}
                                    <Badge variant="default" className="text-sm px-3 py-1 font-extrabold bg-green-600 hover:bg-green-700">
                                        {formatPrice(product.unitAmount)}
                                    </Badge>
                                </CardTitle>
                                <CardDescription className="text-sm">
                                    {product.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="space-y-1 text-sm">
                                    <p className="flex items-center text-gray-700 font-bold">
                                        <ClockIcon className="w-4 h-4 mr-2 text-primary/80" />
                                        Inclus: **{product.slotsRequired}** créneaux de compétition
                                    </p>
                                    {product.includesMeal && (
                                        <p className="flex items-center text-gray-700">
                                            <UtensilsCrossedIcon className="w-4 h-4 mr-2 text-primary/80" />
                                            Comprend: Repas VIP
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="p-4 pt-0">
                                {/* CHANGEMENT : Appel à la sélection de créneaux avant le checkout */}
                                <Button 
                                    className="w-full" 
                                    onClick={() => handlePackSelectionStart(product)}
                                    disabled={registrationClosed}
                                >
                                    {registrationClosed ? 'Inscription Fermée' : 'Sélectionner les Créneaux'}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        );
    };

    // 8. Rendu du contenu de la Sheet de sélection du Pack
    const renderPackSelectionSheetContent = () => {
        if (!packToPurchase) return null;

        const slotsNeeded = packToPurchase.slotsRequired;
        const slotsSelectedCount = selectedPackSlots.length;
        const selectionComplete = slotsSelectedCount === slotsNeeded;
        
        // Catégories disponibles pour la sélection (toutes pour un pack)
        const availablePackCategories = categories.filter(c => c.activeDays.length > 0);
        
        // FIX: Déterminer le jour actif sous forme numérique pour la vérification du statut
        // On s'assure que le résultat de parseInt est du type 1 | 2 pour correspondre à activeDays
        const activeDayNumber = parseInt(activeDay) as 1 | 2; 

        return (
            <SheetContent side="bottom" className="sm:max-w-xl h-[95vh] flex flex-col">
                <SheetHeader>
                    <SheetTitle>Configuration du Pack : {packToPurchase.name}</SheetTitle>
                    <SheetDescription>
                        Veuillez sélectionner **{slotsNeeded} créneaux** pour valider votre achat de pack.
                    </SheetDescription>
                </SheetHeader>

                {/* Barre de progression/status */}
                <div className={`p-3 rounded-lg ${selectionComplete ? 'bg-green-100 border-green-500' : 'bg-yellow-100 border-yellow-500'} border-2 mb-4`}>
                    <p className="font-semibold text-sm flex items-center justify-between">
                        <span>Statut : {slotsSelectedCount} / {slotsNeeded} créneau(x) sélectionné(s)</span>
                        <Badge variant={selectionComplete ? 'default' : 'secondary'} className={selectionComplete ? 'bg-green-600' : 'bg-yellow-600'}>
                            {selectionComplete ? 'Prêt au Paiement' : 'Sélection en cours'}
                        </Badge>
                    </p>
                </div>
                
                {/* Vue Principale: Sélection des Catégories */}
                {!activePackCategoryId ? (
                    <div className="flex-grow overflow-y-auto space-y-4">
                        <h3 className="font-bold text-lg">1. Choisissez vos Catégories ({slotsNeeded} maximum)</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {availablePackCategories.map(category => {
                                // Compter les slots sélectionnés dans cette catégorie pour le pack
                                const selectedInThisCategory = selectedPackSlots.filter(s => s.categoryId === category.id).length;
                                
                                return (
                                    <Card
                                        key={category.id}
                                        className={`cursor-pointer p-3 transition-all ${selectedInThisCategory > 0 ? 'border-primary bg-primary/10' : 'border-gray-200 hover:shadow-md'}`}
                                        onClick={() => {
                                            setActivePackCategoryId(category.id);
                                            // Définir le jour actif par défaut (le premier jour actif)
                                            setActiveDay(category.activeDays.includes(1) ? '1' : '2');
                                        }}
                                    >
                                        <CardTitle className="text-base truncate">{category.name}</CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            {selectedInThisCategory > 0 && (
                                                <span className="font-semibold text-primary">{selectedInThisCategory} sélectionné(s)</span>
                                            )}
                                        </CardDescription>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* Vue Détaillée: Sélection des Slots par Catégorie */
                    <div className="flex-grow flex flex-col">
                        <Button variant="ghost" className="mb-4 self-start" onClick={() => setActivePackCategoryId(null)}>
                            <ArrowLeftIcon className="w-4 h-4 mr-2" />
                            Retour à la sélection des catégories
                        </Button>

                        <h3 className="font-bold text-lg mb-4">2. Choisissez les Créneaux pour {activeCategory?.name}</h3>
                        
                        <Tabs value={activeDay} onValueChange={(value) => setActiveDay(value as '1' | '2')} className="w-full flex-grow flex flex-col">
                            <TabsList className="grid w-full grid-cols-2 flex-shrink-0 mb-4">
                                <TabsTrigger value="1" disabled={!activeCategory?.activeDays.includes(1)}>Jour 1 ({day1Date})</TabsTrigger>
                                <TabsTrigger value="2" disabled={!activeCategory?.activeDays.includes(2)}>Jour 2 ({day2Date})</TabsTrigger>
                            </TabsList>
                            
                            <div className="flex-grow overflow-y-auto pr-2">
                                <TabsContent value={activeDay} className="mt-0">
                                    {filteredSlots.length > 0 || selectedPackSlots.some(s => s.categoryId === activePackCategoryId) ? (
                                        <div className="space-y-2">
                                            {/* Créneaux déjà sélectionnés (même s'ils sont dans la liste complète, on les affiche pour le retrait) */}
                                            {selectedPackSlots
                                                .filter(s => s.categoryId === activePackCategoryId && s.day.toString() === activeDay)
                                                .map(slot => (
                                                    <Button
                                                        key={slot.slotId}
                                                        variant={'default'}
                                                        className={`w-full justify-start transition-colors bg-primary/80 hover:bg-primary`}
                                                        onClick={() => handleTogglePackSlotSelect(availableSlots.find(s => s.id === slot.slotId)!)}
                                                    >
                                                        <CheckCircleIcon className="w-4 h-4 mr-2" />
                                                        <span className="font-semibold">{formatTime(slot.startTime)} (Sélectionné)</span>
                                                        <Badge className={`ml-auto bg-white text-primary hover:bg-white/90`}>
                                                            Retirer
                                                        </Badge>
                                                    </Button>
                                                ))
                                            }

                                            {/* Créneaux disponibles à ajouter */}
                                            {filteredSlots.map(slot => {
                                                const time = slot.startTime instanceof Date ? slot.startTime : (slot.startTime as any).toDate();

                                                return (
                                                    <Button
                                                        key={slot.id}
                                                        variant={'outline'}
                                                        className={`w-full justify-start transition-colors`}
                                                        onClick={() => handleTogglePackSlotSelect(slot)}
                                                        disabled={selectedPackSlots.length >= slotsNeeded} // Désactiver si max atteint
                                                    >
                                                        <ClockIcon className="w-4 h-4 mr-2" />
                                                        <span className="font-semibold">{formatTime(time)}</span>
                                                        <Badge className={`ml-auto bg-primary/10 text-primary hover:bg-primary/20`}>
                                                            Ajouter
                                                        </Badge>
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-center text-sm text-gray-500 p-8 border border-dashed rounded-lg">
                                            {/* FIX: Utilisation de activeDayNumber pour la vérification de type */}
                                            {activeCategory?.activeDays.includes(activeDayNumber) ? "Aucun créneau libre pour ce jour et cette catégorie." : "Cette catégorie n'est pas active ce jour-là."}
                                        </p>
                                    )}
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                )}
                
                <SheetFooter className="mt-4 flex-shrink-0">
                    <Button 
                        type="button" 
                        className="w-full h-12 text-lg"
                        disabled={!selectionComplete}
                        onClick={() => {
                            // On appelle la fonction de checkout final avec le Pack ET les slots réservés
                            onPackCheckout(packToPurchase, selectedPackSlots); 
                            setIsPackSelectionSheetOpen(false); // Fermer le panneau après le déclenchement du paiement
                            setPackToPurchase(null);
                            setSelectedPackSlots([]);
                        }}
                    >
                        Payer le Pack {formatPrice(packToPurchase.unitAmount)}
                    </Button>
                </SheetFooter>
            </SheetContent>
        );
    };

    // 9. Rendu du contenu de la Sheet de sélection des slots individuels (l'ancien 8)
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
    
    // 10. Rendu du contenu de la Sheet du panier (Compléter la fonction)
    const renderCartSheetContent = () => {
        // Calculer le prix total (dans un cas réel, le prix devrait être vérifié côté serveur)
        const totalPrice = selectedSlots.reduce((sum, slot) => {
            const category = categories.find(c => c.id === slot.categoryId);
            return sum + (category?.unitPrice || 0);
        }, 0);

        return (
            <SheetContent side="right" className="sm:max-w-lg flex flex-col">
                <SheetHeader>
                    <SheetTitle>Votre Panier de Réservation</SheetTitle>
                    <SheetDescription>
                        Vérifiez et confirmez les créneaux sélectionnés avant le paiement.
                    </SheetDescription>
                </SheetHeader>
                
                {/* Liste des slots sélectionnés */}
                <div className="py-4 space-y-3 flex-grow overflow-y-auto pr-2">
                    {selectedSlots.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 border border-dashed rounded-lg">
                            Votre panier est vide. Sélectionnez une catégorie pour commencer.
                        </div>
                    ) : (
                        selectedSlots.map(slot => (
                            <Card key={slot.slotId} className="p-3 flex justify-between items-center bg-gray-50 shadow-sm">
                                <div>
                                    <p className="font-semibold">{slot.categoryName}</p>
                                    <p className="text-sm text-gray-500 flex items-center">
                                        <ClockIcon className="w-3 h-3 mr-1"/>
                                        {formatTime(slot.startTime)} - Jour {slot.day}
                                    </p>
                                </div>
                                
                                <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleToggleSelect(availableSlots.find(s => s.id === slot.slotId)!)}
                                >
                                    <XCircleIcon className="w-4 h-4"/>
                                </Button>
                            </Card>
                        ))
                    )}
                </div>
                
                {/* Footer et Total */}
                <SheetFooter className="flex-col pt-4 border-t">
                    <div className="w-full flex justify-between items-center text-lg font-bold mb-3">
                        <span>Total à Payer:</span>
                        <span className="text-2xl text-primary">{formatPrice(totalPrice)}</span>
                    </div>
                    <SheetClose asChild>
                        <Button type="button" variant="outline" className="w-full mb-2">
                            Continuer la Sélection
                        </Button>
                    </SheetClose>
                    <Button 
                        type="button" 
                        className="w-full h-12 text-lg"
                        disabled={selectedSlots.length === 0}
                        onClick={() => {
                            onCheckout(selectedSlots);
                            setIsCartSheetOpen(false); // Fermer le panneau après le déclenchement du paiement
                            setSelectedSlots([]); // Vider le panier après le checkout
                        }}
                    >
                        Procéder au Paiement
                    </Button>
                </SheetFooter>
            </SheetContent>
        );
    };

    // --- Rendu Principal ---
    return (
        <div className="space-y-8">
            {/* Bannière d'en-tête */}
            <h1 className="text-3xl font-extrabold text-gray-900 border-b pb-4 mb-8">
                Réservation de Créneaux de Compétition
            </h1>
            
            {registrationClosed && (
                 <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md">
                    <p className="font-bold">Inscriptions Fermées</p>
                    <p className="text-sm">La date limite d'inscription était le {formatDate(settings.registrationDeadline)}. Il n'est plus possible de réserver de créneaux.</p>
                </div>
            )}
            
            {/* Affichage des Packs */}
            {renderProductPacks()}

            {/* Séparateur pour les créneaux individuels */}
            <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
                <PizzaIcon className="w-6 h-6 mr-2" />
                Catégories de Compétition Individuelles
            </h2>
            
            {/* Cartes des catégories */}
            {renderCategoryCards()}
            
            {/* Bouton Panier flottant */}
            <Button
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 transition-transform hover:scale-105"
                onClick={() => setIsCartSheetOpen(true)}
                disabled={selectedSlots.length === 0}
            >
                <ShoppingCartIcon className="w-6 h-6" />
                {selectedSlots.length > 0 && (
                    <Badge variant="destructive" className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3 rounded-full h-6 w-6 flex items-center justify-center font-bold">
                        {selectedSlots.length}
                    </Badge>
                )}
            </Button>

            {/* Sheet pour la sélection individuelle de slot */}
            <Sheet open={isSlotSheetOpen} onOpenChange={setIsSlotSheetOpen}>
                {renderSlotSheetContent()}
            </Sheet>

            {/* Sheet pour la sélection de pack */}
            <Sheet open={isPackSelectionSheetOpen} onOpenChange={(open) => {
                setIsPackSelectionSheetOpen(open);
                if (!open) {
                    setActivePackCategoryId(null); // Réinitialiser la vue du pack en fermant
                }
            }}>
                {renderPackSelectionSheetContent()}
            </Sheet>
            
            {/* Sheet pour le panier standard */}
            <Sheet open={isCartSheetOpen} onOpenChange={setIsCartSheetOpen}>
                {renderCartSheetContent()}
            </Sheet>
        </div>
    );
}
