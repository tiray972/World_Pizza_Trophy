'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slot, Category, WPTEvent, Product, Participant, MealGuest } from '@/types/firestore';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ShoppingCartIcon, ClockIcon, PizzaIcon, PackageIcon, UtensilsCrossedIcon, CheckCircleIcon, ArrowLeftIcon, UserIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { ParticipantModal } from './ParticipantModal';
import { ParticipantSelector } from './ParticipantSelector';
import {
  getMinSlotsPerBooking,
  getParticipantsPerSlot,
  minSlotsErrorMessage,
  validateBookingSelection,
} from '@/lib/booking/rules';

interface SelectedSlot {
  slotId: string;
  categoryId: string;
  categoryName: string;
  startTime: Date;
  endTime?: Date;
  date: string;
  participant?: Participant; // 👈 1er participant (rétrocompatibilité)
  participants?: (Participant | undefined)[]; // 👥 Tous les participants du créneau (duo = 2)
}

export interface SelectedPackSlot extends SelectedSlot {
  // Aucune propriété supplémentaire
}

interface SlotBookingViewProps {
  availableSlots: Slot[];
  categories: Category[];
  settings: WPTEvent;
  products: Product[];
  registrationClosed: boolean;
  onCheckout: (slots: SelectedSlot[], includeMeal: boolean, mealPrice: number, mealGuests: MealGuest[]) => void | boolean | Promise<void | boolean>;
  onPackCheckout: (product: Product, slots: SelectedPackSlot[]) => void | boolean | Promise<void | boolean>;
}

const formatTime = (date: Date | string): string => {
  let dateObj: Date;
  
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else if (date && typeof date === 'object' && 'toDate' in date) {
    // Firestore Timestamp
    dateObj = (date as any).toDate();
  } else {
    // Fallback
    dateObj = new Date(date as any);
  }
  
  return dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const formatDateDisplay = (date: Date): string =>
  date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

const formatDateISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Convertit une valeur Firestore (Timestamp, Date ou chaîne) en Date. */
const toDateValue = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string);
};

const getCategoryName = (categoryId: string, categories: Category[]): string =>
  categories.find(c => c.id === categoryId)?.name || 'Catégorie inconnue';

const formatPrice = (amount: number): string =>
  amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

export function SlotBookingView({
  availableSlots,
  categories,
  settings,
  products,
  registrationClosed,
  onCheckout,
  onPackCheckout,
}: SlotBookingViewProps) {
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
  const [isSlotSheetOpen, setIsSlotSheetOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const [isPackSelectionSheetOpen, setIsPackSelectionSheetOpen] = useState(false);
  const [packToPurchase, setPackToPurchase] = useState<Product | null>(null);
  const [selectedPackSlots, setSelectedPackSlots] = useState<SelectedPackSlot[]>([]);
  const [activePackCategoryId, setActivePackCategoryId] = useState<string | null>(null);
  
  // 👤 Participant info states
  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
  const [currentSlotForParticipant, setCurrentSlotForParticipant] = useState<SelectedSlot | null>(null);
  const [isPackParticipantModalOpen, setIsPackParticipantModalOpen] = useState(false);
  const [currentPackSlotForParticipant, setCurrentPackSlotForParticipant] = useState<SelectedPackSlot | null>(null);
  // 👥 Index du participant en cours d'édition (catégories en duo)
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState(0);
  
  // 📋 Liste des participants réutilisables
  const [savedParticipants, setSavedParticipants] = useState<Participant[]>([]);
  const [editingParticipantSlot, setEditingParticipantSlot] = useState<string | null>(null);

  // 🍽️ Meal state
  const [wantsMeal, setWantsMeal] = useState(false);
  const [additionalMealGuests, setAdditionalMealGuests] = useState<MealGuest[]>([]);

  // 🔧 DEBUG LOG: Track prop changes
  useEffect(() => {
    console.log('📊 [SlotBookingView] Props updated:');
    console.log(`   - availableSlots: ${availableSlots.length} slots`);
    console.log(`   - categories: ${categories.length} categories`);
    console.log(`   - State: activeCategoryId=${activeCategoryId}, activeDate=${activeDate}`);
  }, [availableSlots, categories, activeCategoryId, activeDate]);

  const eventStartDate = useMemo(() => new Date(settings.eventStartDate), [settings.eventStartDate]);
  const registrationDeadlineDate = useMemo(() => new Date(settings.registrationDeadline), [settings.registrationDeadline]);

  const mealGuests = wantsMeal ? additionalMealGuests : [];

  // 🎟️ Minimum de créneaux imposé par l'événement (paramétré dans le dashboard)
  const minSlotsRequired = getMinSlotsPerBooking(settings);
  const hasTeamCategory = categories.some(category => getParticipantsPerSlot(category) > 1);
  const missingSlotsCount = Math.max(0, minSlotsRequired - selectedSlots.length);

  // 👥 Nombre de participants attendus pour une catégorie (2 pour un duo)
  const participantsRequiredFor = (categoryId: string) =>
    getParticipantsPerSlot(categories.find(category => category.id === categoryId));

  /** Liste des participants d'un créneau, complétée à la longueur attendue. */
  const participantsOf = (slot: SelectedSlot): (Participant | undefined)[] => {
    const required = participantsRequiredFor(slot.categoryId);
    const current = slot.participants ?? (slot.participant ? [slot.participant] : []);
    return Array.from({ length: required }, (_, index) => current[index]);
  };

  /** Renseigne le participant n° index d'un créneau. */
  const withParticipantAt = <T extends SelectedSlot>(
    slot: T,
    index: number,
    participant: Participant
  ): T => {
    const next = participantsOf(slot);
    next[index] = participant;
    return { ...slot, participants: next, participant: next[0] };
  };

  /** Erreurs bloquantes sur une sélection (participants, minimum, doublons). */
  const selectionErrors = (slotsToCheck: SelectedSlot[], enforceMinimum: boolean) =>
    validateBookingSelection({
      slots: slotsToCheck.map(slot => ({
        slotId: slot.slotId,
        categoryId: slot.categoryId,
        participants: participantsOf(slot),
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
      participantsPerCategory: Object.fromEntries(
        categories.map(category => [category.id, getParticipantsPerSlot(category)])
      ),
      categoryNames: Object.fromEntries(categories.map(category => [category.id, category.name])),
      minSlots: enforceMinimum ? getMinSlotsPerBooking(settings) : 1,
    });

  const updateAdditionalMealGuest = (index: number, field: keyof MealGuest, value: string) => {
    setAdditionalMealGuests(prev =>
      prev.map((guest, currentIndex) =>
        currentIndex === index ? { ...guest, [field]: value } : guest
      )
    );
  };

  /** 🍽️ Fixe le nombre de repas (ajoute ou retire des lignes). */
  const setMealGuestsCount = (count: number) => {
    const target = Math.max(1, Math.min(count, 50));
    setWantsMeal(true);
    setAdditionalMealGuests(prev => {
      if (target === prev.length) return prev;
      if (target < prev.length) return prev.slice(0, target);
      return [
        ...prev,
        ...Array.from({ length: target - prev.length }, () => ({ firstName: '', lastName: '' })),
      ];
    });
  };

  const addAdditionalMealGuest = () => {
    setAdditionalMealGuests(prev => [...prev, { firstName: '', lastName: '' }]);
    setWantsMeal(true);
  };

  const activeCategory = useMemo(() => {
    const id = isPackSelectionSheetOpen ? activePackCategoryId : activeCategoryId;
    return id ? categories.find(c => c.id === id) || null : null;
  }, [activeCategoryId, activePackCategoryId, categories, isPackSelectionSheetOpen]);

  // 🔧 FIX: Correct filter logic with proper debugging
  const filteredSlots = useMemo(() => {
    // Determine which category and date we're filtering for
    const currentActiveCategoryId = isPackSelectionSheetOpen ? activePackCategoryId : activeCategoryId;
    const currentActiveDate = activeDate; // Use activeDate directly (works for both modes)


    // Early return if filters are not set
    if (!currentActiveCategoryId || !currentActiveDate) {
      return [];
    }

    const slotsInStandardCart = new Set(selectedSlots.map(s => s.slotId));
    const slotsInPackSelection = new Set(selectedPackSlots.map(s => s.slotId));

    const filtered = availableSlots
      .filter(slot => {
        // Check each condition separately for debugging
        const categoryMatch = slot.categoryId === currentActiveCategoryId;
        const dateMatch = slot.date === currentActiveDate;
        const statusMatch = slot.status === 'available';
        const notInStandardCart = !slotsInStandardCart.has(slot.id);
        const notInPackSelection = !slotsInPackSelection.has(slot.id);

        // 🔇 Log volontairement supprimé : il imprimait une ligne par créneau
        // (269 lignes à chaque rendu), ce qui saturait la console et ralentissait
        // fortement la sélection sur mobile.

        return categoryMatch && dateMatch && statusMatch && notInStandardCart && notInPackSelection;
      })
      .sort((a, b) => {
        // Convert startTime to Date if needed
        let timeA: number;
        let timeB: number;
        
        if (a.startTime instanceof Date) {
          timeA = a.startTime.getTime();
        } else if (a.startTime && typeof a.startTime === 'object' && 'toDate' in a.startTime) {
          timeA = (a.startTime as any).toDate().getTime();
        } else {
          timeA = new Date(a.startTime as any).getTime();
        }
        
        if (b.startTime instanceof Date) {
          timeB = b.startTime.getTime();
        } else if (b.startTime && typeof b.startTime === 'object' && 'toDate' in b.startTime) {
          timeB = (b.startTime as any).toDate().getTime();
        } else {
          timeB = new Date(b.startTime as any).getTime();
        }
        
        return timeA - timeB;
      });

    return filtered;
  }, [availableSlots, activeCategoryId, activePackCategoryId, activeDate, selectedSlots, selectedPackSlots, isPackSelectionSheetOpen]);

  // 🔧 FIX: When category is clicked, automatically set the first available date
  const handleCategoryClick = (category: Category) => {
    console.log(`📌 [handleCategoryClick] Category clicked: ${category.name} (${category.id})`);
    console.log(`   - activeDates: ${category.activeDates.join(', ')}`);
    
    setActiveCategoryId(category.id);
    // ⭐ CRITICAL FIX: Set the first date IMMEDIATELY when category is clicked
    const firstDate = category.activeDates.length > 0 ? category.activeDates[0] : null;
    setActiveDate(firstDate);
    console.log(`   - activeDate set to: ${firstDate}`);
    
    setIsSlotSheetOpen(true);
  };

  const handlePackSelectionStart = (product: Product) => {
    console.log(`📦 [handlePackSelectionStart] Pack selected: ${product.name}`);
    setPackToPurchase(product);
    setSelectedPackSlots([]);
    setActivePackCategoryId(null); // Reset to category selection view
    setActiveDate(null); // Reset date when starting pack selection
    setIsPackSelectionSheetOpen(true);
  };

  const handleToggleSelect = (slot: Slot) => {
    const isCurrentlySelected = selectedSlots.some(s => s.slotId === slot.id);
    
    // Convert startTime to Date if it's a Firestore Timestamp
    let startTime: Date;
    if (slot.startTime instanceof Date) {
      startTime = slot.startTime;
    } else if (slot.startTime && typeof slot.startTime === 'object' && 'toDate' in slot.startTime) {
      startTime = (slot.startTime as any).toDate();
    } else {
      startTime = new Date(slot.startTime as any);
    }

    if (isCurrentlySelected) {
      setSelectedSlots(selectedSlots.filter(s => s.slotId !== slot.id));
    } else {
      const newSlot: SelectedSlot = {
        slotId: slot.id,
        categoryId: slot.categoryId,
        categoryName: getCategoryName(slot.categoryId, categories),
        startTime,
        endTime: toDateValue(slot.endTime),
        date: slot.date,
      };
      setSelectedSlots([...selectedSlots, newSlot]);
    }
  };

  const handleTogglePackSlotSelect = (slot: Slot) => {
    if (!packToPurchase) return;

    const isCurrentlySelected = selectedPackSlots.some(s => s.slotId === slot.id);
    
    // Convert startTime to Date if it's a Firestore Timestamp
    let startTime: Date;
    if (slot.startTime instanceof Date) {
      startTime = slot.startTime;
    } else if (slot.startTime && typeof slot.startTime === 'object' && 'toDate' in slot.startTime) {
      startTime = (slot.startTime as any).toDate();
    } else {
      startTime = new Date(slot.startTime as any);
    }

    if (isCurrentlySelected) {
      setSelectedPackSlots(selectedPackSlots.filter(s => s.slotId !== slot.id));
    } else {
      if (selectedPackSlots.length < packToPurchase.slotsRequired) {
        const newSlot: SelectedPackSlot = {
          slotId: slot.id,
          categoryId: slot.categoryId,
          categoryName: getCategoryName(slot.categoryId, categories),
          startTime,
          endTime: toDateValue(slot.endTime),
          date: slot.date,
        };
        setSelectedPackSlots([...selectedPackSlots, newSlot]);
      }
    }
  };

  // �� Sauvegarder un participant dans la liste réutilisable (évite les doublons)
  const handleSaveParticipant = (participant: Participant) => {
    const exists = savedParticipants.some(
      p => p.firstName === participant.firstName && p.lastName === participant.lastName
    );
    if (!exists) {
      setSavedParticipants([...savedParticipants, participant]);
    }
  };

  const renderCategoryCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {categories.map(category => {
        const datesDisplay = category.activeDates.map(dateStr => {
          const dateObj = new Date(dateStr + 'T00:00:00');
          return formatDateDisplay(dateObj);
        }).join(' & ');

        return (
          <Card
            key={category.id}
            className={`cursor-pointer transition-all hover:shadow-lg hover:border-primary border-gray-200 ${
              registrationClosed ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={() => !registrationClosed && handleCategoryClick(category)}
          >
            <CardHeader className="p-3">
              <CardTitle className="text-base truncate flex items-center">
                <PizzaIcon className="w-4 h-4 mr-1 text-primary" />
                {category.name}
              </CardTitle>
              <CardDescription className="text-xs">
                {category.description.substring(0, 30)}
                {category.description.length > 30 ? '...' : ''}
              </CardDescription>
            </CardHeader>
            <CardFooter className="p-3 pt-0 flex flex-wrap gap-1">
              {/* 💶 Prix de la catégorie, visible directement dans la grille */}
              <Badge className="text-xs bg-primary hover:bg-primary/90">
                {formatPrice(category.unitPrice)}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <CalendarIcon className="w-3 h-3 mr-1" />
                {datesDisplay}
              </Badge>
              {/* 👥 Catégorie en équipe : prévenir avant la sélection */}
              {getParticipantsPerSlot(category) > 1 && (
                <Badge
                  className="text-xs bg-blue-600 hover:bg-blue-700"
                  title={`Catégorie en équipe : un seul créneau et un seul tarif pour ${getParticipantsPerSlot(category)} participants`}
                >
                  <UserIcon className="w-3 h-3 mr-1" />
                  En équipe · {getParticipantsPerSlot(category)} participants
                </Badge>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );

  const renderProductPacks = () => {
    const activePacks = products.filter(p => p.isPack && p.isActive);

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
              className={`bg-white shadow-lg transition-transform hover:scale-[1.02] ${
                registrationClosed ? 'opacity-50' : 'border-primary'
              }`}
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
                    Inclus: {product.slotsRequired} créneaux de compétition
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

  const renderPackSelectionSheetContent = () => {
    if (!packToPurchase) return null;

    const slotsNeeded = packToPurchase.slotsRequired;
    const slotsSelectedCount = selectedPackSlots.length;
    const selectionComplete = slotsSelectedCount === slotsNeeded;
    // Les packs imposent déjà leur nombre de créneaux : pas de minimum supplémentaire.
    const packSelectionErrors = selectionErrors(selectedPackSlots, false);
    const availablePackCategories = categories.filter(c => c.activeDates.length > 0);

    return (
      <SheetContent side="bottom" className="sm:max-w-xl h-screen flex flex-col">
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle>Configuration du Pack : {packToPurchase.name}</SheetTitle>
          <SheetDescription>
            Veuillez sélectionner {slotsNeeded} créneau(x) pour valider votre achat de pack.
          </SheetDescription>
        </SheetHeader>

        <div
          className={`shrink-0 p-3 rounded-lg ${
            selectionComplete ? 'bg-green-100 border-green-500' : 'bg-yellow-100 border-yellow-500'
          } border-2 mb-4`}
        >
          <p className="font-semibold text-sm flex items-center justify-between">
            <span>
              Statut : {slotsSelectedCount} / {slotsNeeded} créneau(x) sélectionné(s)
            </span>
            <Badge
              variant={selectionComplete ? 'default' : 'secondary'}
              className={selectionComplete ? 'bg-green-600' : 'bg-yellow-600'}
            >
              {selectionComplete ? 'Prêt au Paiement' : 'Sélection en cours'}
            </Badge>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 min-h-0">
          {!activePackCategoryId ? (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">
                1. Choisissez vos Catégories ({slotsNeeded} maximum)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {availablePackCategories.map(category => {
                  const selectedInThisCategory = selectedPackSlots.filter(
                    s => s.categoryId === category.id
                  ).length;

                  return (
                    <Card
                      key={category.id}
                      className={`cursor-pointer p-3 transition-all ${
                        selectedInThisCategory > 0
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-200 hover:shadow-md'
                      }`}
                      onClick={() => {
                        setActivePackCategoryId(category.id);
                        // ⭐ Set first date when entering pack category selection
                        setActiveDate(
                          category.activeDates.length > 0 ? category.activeDates[0] : null
                        );
                      }}
                    >
                      <CardTitle className="text-base truncate">{category.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {selectedInThisCategory > 0 && (
                          <span className="font-semibold text-primary">
                            {selectedInThisCategory} sélectionné(s)
                          </span>
                        )}
                      </CardDescription>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                variant="ghost"
                className="shrink-0"
                onClick={() => setActivePackCategoryId(null)}
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Retour à la sélection des catégories
              </Button>

              <h3 className="font-bold text-lg">
                2. Choisissez les Créneaux pour {activeCategory?.name}
              </h3>

              {activeCategory && activeCategory.activeDates.length > 0 ? (
                <Tabs
                  value={activeDate || ''}
                  onValueChange={setActiveDate}
                  className="w-full flex flex-col"
                >
                  <TabsList className="grid w-full shrink-0 mb-4" style={{ gridTemplateColumns: `repeat(${activeCategory.activeDates.length}, 1fr)` }}>
                    {activeCategory.activeDates.map(dateStr => {
                      const dateObj = new Date(dateStr + 'T00:00:00');
                      const displayLabel = formatDateDisplay(dateObj);
                      return (
                        <TabsTrigger key={dateStr} value={dateStr}>
                          {displayLabel}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  <div className="space-y-2">
                    {activeCategory.activeDates.map(dateStr => (
                      <TabsContent key={dateStr} value={dateStr} className="mt-0 space-y-2">
                        {filteredSlots.length > 0 ||
                        selectedPackSlots.some(s => s.categoryId === activePackCategoryId && s.date === dateStr) ? (
                          <>
                            {selectedPackSlots
                              .filter(s => s.categoryId === activePackCategoryId && s.date === dateStr)
                              .map(slot => (
                                <Card
                                  key={slot.slotId}
                                  className="p-3 bg-primary/5 border-2 border-primary mb-3"
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <Button
                                      variant="default"
                                      className="flex-1 justify-start transition-colors bg-primary/80 hover:bg-primary"
                                      onClick={() =>
                                        handleTogglePackSlotSelect(
                                          availableSlots.find(s => s.id === slot.slotId)!
                                        )
                                      }
                                    >
                                      <CheckCircleIcon className="w-4 h-4 mr-2" />
                                      <span className="font-semibold">
                                        {formatTime(slot.startTime)}
                                      </span>
                                    </Button>
                                    <Badge className="ml-2 bg-white text-primary hover:bg-white/90">
                                      Retirer
                                    </Badge>
                                  </div>
                                  {/* 👤 Sélecteur(s) de participant réutilisable(s) */}
                                  <div className="mt-2 space-y-2">
                                    {participantsOf(slot).map((participant, index) => (
                                      <div key={index}>
                                        {participantsRequiredFor(slot.categoryId) > 1 && (
                                          <p className="text-[11px] font-semibold text-gray-600 mb-1">
                                            Participant {index + 1}
                                          </p>
                                        )}
                                        <ParticipantSelector
                                          participants={savedParticipants}
                                          selectedParticipant={participant}
                                          onSelect={(selected) => {
                                            setSelectedPackSlots(
                                              selectedPackSlots.map(s =>
                                                s.slotId === slot.slotId
                                                  ? withParticipantAt(s, index, selected)
                                                  : s
                                              )
                                            );
                                          }}
                                          onAddNew={() => {
                                            setCurrentPackSlotForParticipant(slot);
                                            setCurrentParticipantIndex(index);
                                            setIsPackParticipantModalOpen(true);
                                          }}
                                          compact={true}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </Card>
                              ))}

                            {filteredSlots.map(slot => {
                              // Convert startTime to Date if needed
                              let time: Date;
                              if (slot.startTime instanceof Date) {
                                time = slot.startTime;
                              } else if (slot.startTime && typeof slot.startTime === 'object' && 'toDate' in slot.startTime) {
                                time = (slot.startTime as any).toDate();
                              } else {
                                time = new Date(slot.startTime as any);
                              }
                              return (
                                <Button
                                  key={slot.id}
                                  variant="outline"
                                  className="w-full justify-start transition-colors"
                                  onClick={() => handleTogglePackSlotSelect(slot)}
                                  disabled={selectedPackSlots.length >= slotsNeeded}
                                >
                                  <ClockIcon className="w-4 h-4 mr-2" />
                                  <span className="font-semibold">{formatTime(time)}</span>
                                  <Badge className="ml-auto bg-primary/10 text-primary hover:bg-primary/20">
                                    Ajouter
                                  </Badge>
                                </Button>
                              );
                            })}
                          </>
                        ) : (
                          <p className="text-center text-sm text-gray-500 p-8 border border-dashed rounded-lg">
                            Aucun créneau libre pour ce jour et cette catégorie.
                          </p>
                        )}
                      </TabsContent>
                    ))}
                  </div>
                </Tabs>
              ) : (
                <p className="text-center text-sm text-gray-500 p-8 border border-dashed rounded-lg">
                  Aucune date disponible pour cette catégorie.
                </p>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 mt-4 border-t pt-3 flex flex-col gap-3">
          {/* ⚠️ Vérifier que tous les participants sont remplis */}
          {packSelectionErrors.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-1">
              {packSelectionErrors.map((message, index) => (
                <p key={index} className="text-xs text-yellow-700 font-semibold">⚠️ {message}</p>
              ))}
            </div>
          )}

          <Button
            type="button"
            className="w-full h-12 text-lg"
            disabled={!selectionComplete || packSelectionErrors.length > 0}
            onClick={async () => {
              const success = await onPackCheckout(packToPurchase, selectedPackSlots);
              // ⚠️ Conserver la sélection si le paiement n'a pas pu être lancé.
              if (success === false) return;
              setIsPackSelectionSheetOpen(false);
              setPackToPurchase(null);
              setSelectedPackSlots([]);
              setActivePackCategoryId(null);
              setActiveDate(null);
            }}
          >
            Payer le Pack {formatPrice(packToPurchase.unitAmount)}
          </Button>
        </SheetFooter>
      </SheetContent>
    );
  };

  const renderSlotSheetContent = () => {
    if (!activeCategory) return null;

    return (
      <SheetContent side="bottom" className="sm:max-w-xl h-screen flex flex-col">
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle>{activeCategory.name}</SheetTitle>
          <SheetDescription>
            Sélectionnez vos créneaux horaires pour cette catégorie.
            {activeCategory && participantsRequiredFor(activeCategory.id) > 1 && (
              <span className="block mt-1 font-semibold text-blue-700">
                👥 Catégorie en équipe : un seul créneau et un seul tarif pour{' '}
                {participantsRequiredFor(activeCategory.id)} participants. Vous renseignerez leurs
                noms dans le panier.
              </span>
            )}
            {minSlotsRequired > 1 && missingSlotsCount > 0 && (
              <span className="block mt-1 font-semibold text-yellow-700">
                🎟️ {minSlotsRequired} catégories minimum : il vous en manque encore{' '}
                {missingSlotsCount}
                {selectedSlots.length > 0 ? ' — choisissez ensuite une autre catégorie' : ''}.
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {activeCategory.activeDates.length > 0 ? (
          <Tabs
            value={activeDate || ''}
            onValueChange={setActiveDate}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList
              className="grid w-full shrink-0 mb-4"
              style={{ gridTemplateColumns: `repeat(${activeCategory.activeDates.length}, 1fr)` }}
            >
              {activeCategory.activeDates.map(dateStr => {
                const dateObj = new Date(dateStr + 'T00:00:00');
                const displayLabel = formatDateDisplay(dateObj);
                return (
                  <TabsTrigger key={dateStr} value={dateStr}>
                    {displayLabel}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="flex-1 overflow-y-auto px-2">
              {activeCategory.activeDates.map(dateStr => (
                <TabsContent key={dateStr} value={dateStr} className="mt-0 space-y-2">
                  {filteredSlots.length > 0 ? (
                    <>
                      {filteredSlots.map(slot => {
                        const isSelected = selectedSlots.some(s => s.slotId === slot.id);
                        
                        // Convert startTime to Date if needed
                        let time: Date;
                        if (slot.startTime instanceof Date) {
                          time = slot.startTime;
                        } else if (slot.startTime && typeof slot.startTime === 'object' && 'toDate' in slot.startTime) {
                          time = (slot.startTime as any).toDate();
                        } else {
                          time = new Date(slot.startTime as any);
                        }

                        return (
                          <Button
                            key={slot.id}
                            variant={isSelected ? 'default' : 'outline'}
                            className="w-full justify-start transition-colors"
                            onClick={() => handleToggleSelect(slot)}
                          >
                            <ClockIcon className="w-4 h-4 mr-2" />
                            <span className="font-semibold">{formatTime(time)}</span>
                            <Badge
                              className={`ml-auto ${
                                isSelected
                                  ? 'bg-white text-primary'
                                  : 'bg-primary/10 text-primary hover:bg-primary/20'
                              }`}
                            >
                              {isSelected ? 'Retirer' : 'Ajouter'}
                            </Badge>
                          </Button>
                        );
                      })}
                      <div className="h-6" />
                    </>
                  ) : (
                    <p className="text-center text-sm text-gray-500 p-8 border border-dashed rounded-lg">
                      Aucun créneau libre pour ce jour et cette catégorie.
                    </p>
                  )}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        ) : (
          <p className="text-center text-sm text-gray-500 p-8 border border-dashed rounded-lg">
            Aucune date disponible pour cette catégorie.
          </p>
        )}

        <SheetFooter className="shrink-0 mt-4 border-t pt-3">
          <SheetClose asChild>
            <Button type="button" className="w-full">
              OK, Créneaux Ajoutés au Panier
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    );
  };

  const renderCartSheetContent = () => {
    // Calculer les totaux séparément
    const slotTotal = selectedSlots.reduce((sum, slot) => {
      const category = categories.find(c => c.id === slot.categoryId);
      return sum + (category?.unitPrice || 0);
    }, 0);
    
    const mealPrice = settings.mealPrice || 0;
    const validMealGuestsCount = mealGuests.filter(
      guest => guest.firstName.trim() && guest.lastName.trim()
    ).length;
    // ⚠️ Seuls les repas nommés sont facturés : le total affiché doit s'aligner
    // sur ce que la caisse Stripe encaissera réellement.
    const incompleteMealGuests = mealGuests.length - validMealGuestsCount;
    const mealCost = wantsMeal && mealPrice > 0 ? mealPrice * validMealGuestsCount : 0;
    const totalPrice = slotTotal + mealCost;
    // Le minimum de créneaux ne s'applique pas à un panier « repas uniquement ».
    const cartErrors = selectionErrors(selectedSlots, true);
    // Le minimum a droit à son propre encart, avec le bouton pour y remédier.
    const otherCartErrors = cartErrors.filter(
      message => message !== minSlotsErrorMessage(minSlotsRequired)
    );
    const missingCategories = selectedSlots.length > 0 ? missingSlotsCount : 0;

    return (
      <SheetContent side="right" className="sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Votre Panier de Réservation</SheetTitle>
          <SheetDescription>
            Vérifiez et confirmez les créneaux sélectionnés avant le paiement.
            {minSlotsRequired > 1 && (
              <span
                className={`block mt-1 font-semibold ${
                  missingSlotsCount > 0 ? 'text-yellow-700' : 'text-green-700'
                }`}
              >
                🎟️ {minSlotsRequired} catégories minimum —{' '}
                {missingSlotsCount > 0
                  ? `il vous en manque ${missingSlotsCount}`
                  : 'minimum atteint'}
                .
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-3 grow overflow-y-auto pr-2">
          {selectedSlots.length === 0 ? (
            <div className="p-8 text-center text-gray-500 border border-dashed rounded-lg">
              Aucun créneau sélectionné. Vous pouvez acheter uniquement des repas si besoin.
            </div>
          ) : (
            selectedSlots.map(slot => {
              const dateObj = new Date(slot.date + 'T00:00:00');
              const displayDate = formatDateDisplay(dateObj);
              const slotParticipants = participantsOf(slot);
              const requiredParticipants = participantsRequiredFor(slot.categoryId);
              const allParticipantsFilled = slotParticipants.every(
                participant => !!participant?.shirtSize
              );

              return (
                <Card key={slot.slotId} className={`p-3 bg-gray-50 shadow-sm ${allParticipantsFilled ? 'border-green-200 border-2' : 'border-yellow-200 border-2'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-semibold">{slot.categoryName}</p>
                      <p className="text-sm text-gray-500 flex items-center">
                        <ClockIcon className="w-3 h-3 mr-1" />
                        {formatTime(slot.startTime)} - {displayDate}
                      </p>
                      
                      {/* 👥 Catégorie en duo : préciser le nombre de participants attendus */}
                      {requiredParticipants > 1 && (
                        <p className="text-xs text-blue-700 font-semibold mt-1">
                          👥 Catégorie en équipe : {requiredParticipants} participants sur ce
                          créneau, un seul tarif
                        </p>
                      )}

                      {/* 👤 Afficher les infos des participants renseignés */}
                      {slotParticipants.map((participant, index) =>
                        participant ? (
                          <div key={index} className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                            <p className="text-xs font-semibold text-green-700">
                              <UserIcon className="w-3 h-3 inline mr-1" />
                              {requiredParticipants > 1 ? `${index + 1}. ` : ''}
                              {participant.firstName} {participant.lastName}
                            </p>
                            {participant.email && (
                              <p className="text-xs text-green-600">{participant.email}</p>
                            )}
                            {participant.shirtSize && (
                              <p className="text-xs text-green-600">T-shirt: {participant.shirtSize}</p>
                            )}
                          </div>
                        ) : null
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      {/* Bouton(s) pour ajouter/modifier les infos des participants */}
                      {slotParticipants.map((participant, index) => (
                        <div key={index}>
                          {requiredParticipants > 1 && (
                            <p className="text-[11px] font-semibold text-gray-600 mb-1">
                              Participant {index + 1}
                            </p>
                          )}
                          <ParticipantSelector
                            participants={savedParticipants}
                            selectedParticipant={participant}
                            onSelect={(selected) => {
                              setSelectedSlots(
                                selectedSlots.map(s =>
                                  s.slotId === slot.slotId
                                    ? withParticipantAt(s, index, selected)
                                    : s
                                )
                              );
                            }}
                            onAddNew={() => {
                              setCurrentSlotForParticipant(slot);
                              setCurrentParticipantIndex(index);
                              setIsParticipantModalOpen(true);
                            }}
                            compact={true}
                          />
                        </div>
                      ))}

                      {/* Bouton pour supprimer le créneau */}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs px-3"
                        onClick={() =>
                          handleToggleSelect(availableSlots.find(s => s.id === slot.slotId)!)
                        }
                      >
                        Supprimer le créneau
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
          
          {/* 🍽️ Option Repas */}
          {mealPrice > 0 && (
            <Card className="p-4 bg-blue-50 border-2 border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 flex items-center">
                    <UtensilsCrossedIcon className="w-4 h-4 mr-2" />
                    Ajouter des repas
                  </p>
                  <p className="text-sm text-blue-700">
                    {formatPrice(mealPrice)} par personne, indépendant des créneaux de compétition.
                    {' '}Vous pouvez acheter des repas <strong>sans réserver de catégorie</strong>.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={wantsMeal ? "default" : "outline"}
                  className={wantsMeal ? "bg-blue-600 hover:bg-blue-700" : ""}
                  onClick={() => {
                    if (wantsMeal) {
                      setWantsMeal(false);
                      setAdditionalMealGuests([]);
                    } else {
                      setWantsMeal(true);
                      if (additionalMealGuests.length === 0) {
                        setAdditionalMealGuests([{ firstName: '', lastName: '' }]);
                      }
                    }
                  }}
                >
                  {wantsMeal ? "✓ Inclus" : "+ Ajouter"}
                </Button>
              </div>
              {wantsMeal && (
                <div className="mt-4 space-y-3">
                  {/* 🍽️ Nombre de repas : compteur direct (− / +) */}
                  <div className="flex items-center justify-between rounded-md bg-white border border-blue-200 p-3">
                    <div>
                      <p className="text-sm font-semibold text-blue-950">Nombre de repas</p>
                      <p className="text-xs text-blue-700">
                        {additionalMealGuests.length} × {formatPrice(mealPrice)} ={' '}
                        {formatPrice(additionalMealGuests.length * mealPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0 text-lg"
                        disabled={additionalMealGuests.length <= 1}
                        onClick={() => setMealGuestsCount(additionalMealGuests.length - 1)}
                      >
                        −
                      </Button>
                      <span className="w-8 text-center text-lg font-bold text-blue-900">
                        {additionalMealGuests.length}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-9 p-0 text-lg bg-blue-600 hover:bg-blue-700"
                        onClick={() => setMealGuestsCount(additionalMealGuests.length + 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md bg-white/70 border border-blue-100 p-3">
                    <p className="text-xs font-semibold text-blue-900 mb-2">Récapitulatif repas</p>
                    {mealGuests.length === 0 ? (
                      <p className="text-xs text-blue-700">Ajoutez les personnes qui mangeront pour préparer le récapitulatif.</p>
                    ) : (
                      <div className="space-y-1">
                        {mealGuests.map((guest, index) => (
                          <div key={`${guest.firstName}-${guest.lastName}-${index}`} className="flex justify-between gap-3 text-xs text-blue-800">
                            <span>{guest.firstName || `Repas ${index + 1}`} {guest.lastName || ""}</span>
                            <span>{formatPrice(mealPrice)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {additionalMealGuests.map((guest, index) => (
                    <div key={index} className="rounded-md bg-white border border-blue-100 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-blue-950">Repas {index + 1}</p>
                          <p className="text-xs text-blue-700">Nom de la personne qui mangera</p>
                        </div>
                        {additionalMealGuests.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAdditionalMealGuests(prev => prev.filter((_, currentIndex) => currentIndex !== index))}
                          >
                            Retirer
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={guest.firstName}
                          onChange={(e) => updateAdditionalMealGuest(index, 'firstName', e.target.value)}
                          placeholder="Prénom"
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        />
                        <input
                          value={guest.lastName}
                          onChange={(e) => updateAdditionalMealGuest(index, 'lastName', e.target.value)}
                          placeholder="Nom"
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={guest.email || ''}
                          onChange={(e) => updateAdditionalMealGuest(index, 'email', e.target.value)}
                          placeholder="Email optionnel"
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        />
                        <input
                          value={guest.phone || ''}
                          onChange={(e) => updateAdditionalMealGuest(index, 'phone', e.target.value)}
                          placeholder="Téléphone optionnel"
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        />
                      </div>
                    </div>
                  ))}

                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={addAdditionalMealGuest}>
                    + Ajouter un autre repas
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>

        <SheetFooter className="flex-col pt-4 border-t">
          {/* Détail des coûts */}
          <div className="w-full space-y-2 mb-4 text-sm">
            <div className="flex justify-between">
              <span>Créneaux ({selectedSlots.length}):</span>
              <span>{formatPrice(slotTotal)}</span>
            </div>
            {wantsMeal && mealCost > 0 && (
              <div className="flex justify-between text-blue-600 font-semibold">
                <span>Repas ({validMealGuestsCount}):</span>
                <span>{formatPrice(mealCost)}</span>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="w-full flex justify-between items-center text-lg font-bold mb-3 border-t pt-3">
            <span>Total à Payer:</span>
            <span className="text-2xl text-primary">{formatPrice(totalPrice)}</span>
          </div>

          {/* ⚠️ Repas sans nom : ils ne seront pas facturés */}
          {wantsMeal && incompleteMealGuests > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-3">
              <p className="text-xs text-yellow-700 font-semibold">
                ⚠️ {incompleteMealGuests} repas sans nom : renseignez le prénom et le nom de
                chaque personne, sinon ces repas ne seront pas comptés.
              </p>
            </div>
          )}

          {/* 🎟️ Minimum non atteint : on explique et on propose l'action */}
          {missingCategories > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg mb-3 space-y-2">
              <p className="text-sm font-bold text-yellow-900">
                🎟️ Il vous manque {missingCategories} catégorie
                {missingCategories > 1 ? 's' : ''} pour pouvoir payer
              </p>
              <p className="text-xs text-yellow-800">
                L'inscription se fait dans {minSlotsRequired} catégories différentes minimum.
                {selectedSlots.some(slot => participantsRequiredFor(slot.categoryId) > 1)
                  ? " Une catégorie en équipe compte pour une seule catégorie, même avec 2 participants."
                  : ''}
              </p>
              <p className="text-xs text-yellow-700">
                💡 Vous pouvez aussi inscrire une autre personne sur un créneau supplémentaire :
                chaque passage compte.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full bg-white"
                onClick={() => setIsCartSheetOpen(false)}
              >
                Choisir une autre catégorie
              </Button>
            </div>
          )}

          {/* ⚠️ Autres règles bloquantes : participants manquants, doublons */}
          {otherCartErrors.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-3 space-y-1">
              {otherCartErrors.map((message, index) => (
                <p key={index} className="text-xs text-yellow-700 font-semibold">⚠️ {message}</p>
              ))}
            </div>
          )}

          <SheetClose asChild>
            <Button type="button" variant="outline" className="w-full mb-2">
              Continuer la Sélection
            </Button>
          </SheetClose>
          <Button
            type="button"
            className="w-full h-12 text-lg"
            disabled={
              (selectedSlots.length === 0 && validMealGuestsCount === 0) ||
              cartErrors.length > 0
            }
            onClick={async () => {
              const cleanedMealGuests = mealGuests
                .map(guest => ({
                  ...guest,
                  firstName: guest.firstName.trim(),
                  lastName: guest.lastName.trim(),
                  email: guest.email?.trim() || undefined,
                  phone: guest.phone?.trim() || undefined,
                }))
                .filter(guest => guest.firstName && guest.lastName);

              const success = await onCheckout(
                selectedSlots,
                wantsMeal && cleanedMealGuests.length > 0,
                mealPrice,
                cleanedMealGuests
              );

              // ⚠️ Ne jamais vider le panier si le paiement n'a pas pu être lancé :
              // l'utilisateur perdait sa sélection et ne pouvait plus s'inscrire.
              if (success === false) return;

              setIsCartSheetOpen(false);
              setSelectedSlots([]);
              setWantsMeal(false);
              setAdditionalMealGuests([]);
            }}
          >
            Procéder au Paiement
          </Button>
        </SheetFooter>
      </SheetContent>
    );
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-gray-900 border-b pb-4 mb-8">
        Réservation de Créneaux de Compétition
      </h1>

      {registrationClosed && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md">
          <p className="font-bold">Inscriptions Fermées</p>
          <p className="text-sm">
            La date limite d'inscription était le {formatDateDisplay(registrationDeadlineDate)}.
            Il n'est plus possible de réserver de créneaux.
          </p>
        </div>
      )}

      {/* 🎟️ Rappel permanent du minimum de créneaux (valeur du dashboard) */}
      {!registrationClosed && minSlotsRequired > 1 && (
        <div
          className={`p-4 rounded-lg border shadow-sm ${
            selectedSlots.length === 0
              ? 'bg-blue-50 border-blue-300 text-blue-900'
              : missingSlotsCount > 0
                ? 'bg-yellow-50 border-yellow-400 text-yellow-900'
                : 'bg-green-50 border-green-400 text-green-900'
          }`}
        >
          <p className="font-bold">
            🎟️ Inscription : {minSlotsRequired} catégories minimum
          </p>
          <p className="text-sm">
            {selectedSlots.length === 0
              ? `Vous devez vous inscrire dans au moins ${minSlotsRequired} catégories différentes. Une catégorie = un créneau = un passage.`
              : missingSlotsCount > 0
                ? `${selectedSlots.length} catégorie(s) sélectionnée(s) — il vous en manque encore ${missingSlotsCount} pour pouvoir payer.`
                : `${selectedSlots.length} catégories sélectionnées : vous pouvez procéder au paiement.`}
          </p>
          {/* 💡 Deux personnes différentes sur une même catégorie : c'est permis */}
          {selectedSlots.length > 0 && missingSlotsCount > 0 && (
            <p className="text-sm mt-2">
              💡 Une même personne ne peut pas concourir deux fois dans la même catégorie, mais vous
              pouvez inscrire <strong>une autre personne</strong> sur un créneau supplémentaire :
              chaque passage compte.
            </p>
          )}

          {/* 👥 Lever la confusion : une catégorie en équipe reste UNE catégorie */}
          {hasTeamCategory && (
            <p className="text-sm mt-2">
              👥 Les catégories en équipe (badge « 2 participants ») comptent pour{' '}
              <strong>une seule catégorie</strong> : un seul créneau, un seul tarif, et vous y
              inscrivez simplement 2 personnes.
            </p>
          )}
          {/* 🍽️ Le minimum ne concerne QUE les catégories : les repas s'achètent seuls */}
          {(settings.mealPrice || 0) > 0 && (
            <p className="text-sm mt-2 pt-2 border-t border-current/20">
              🍽️ Ce minimum ne concerne que les catégories de compétition.{' '}
              <strong>Les repas peuvent être achetés seuls</strong>, sans aucun créneau.
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-2 h-7 text-xs bg-white"
                onClick={() => setIsCartSheetOpen(true)}
              >
                <UtensilsCrossedIcon className="w-3 h-3 mr-1" />
                Acheter des repas uniquement
              </Button>
            </p>
          )}
        </div>
      )}

      {renderProductPacks()}

      <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
        <PizzaIcon className="w-6 h-6 mr-2" />
        Catégories de Compétition Individuelles
      </h2>

      {renderCategoryCards()}

      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 transition-transform hover:scale-105"
        onClick={() => setIsCartSheetOpen(true)}
        disabled={selectedSlots.length === 0 && (settings.mealPrice || 0) <= 0}
      >
        <ShoppingCartIcon className="w-6 h-6" />
        {(selectedSlots.length > 0 || mealGuests.length > 0) && (
          <Badge
            variant="destructive"
            className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3 rounded-full h-6 w-6 flex items-center justify-center font-bold"
          >
            {selectedSlots.length + mealGuests.filter(guest => guest.firstName.trim() && guest.lastName.trim()).length}
          </Badge>
        )}
      </Button>

      <Sheet open={isSlotSheetOpen} onOpenChange={setIsSlotSheetOpen}>
        {renderSlotSheetContent()}
      </Sheet>

      <Sheet
        open={isPackSelectionSheetOpen}
        onOpenChange={open => {
          setIsPackSelectionSheetOpen(open);
          if (!open) {
            setActivePackCategoryId(null);
            setActiveDate(null);
            setPackToPurchase(null);
            setSelectedPackSlots([]);
          }
        }}
      >
        {renderPackSelectionSheetContent()}
      </Sheet>

      <Sheet open={isCartSheetOpen} onOpenChange={setIsCartSheetOpen}>
        {renderCartSheetContent()}
      </Sheet>

      {/* 👤 Participant Modal - Créneaux Individuels */}
      <ParticipantModal
        open={isParticipantModalOpen}
        onClose={() => {
          setIsParticipantModalOpen(false);
          setCurrentSlotForParticipant(null);
          setCurrentParticipantIndex(0);
        }}
        onConfirm={(participant) => {
          if (currentSlotForParticipant) {
            // Mettre à jour le participant n° currentParticipantIndex du créneau
            setSelectedSlots(selectedSlots.map(slot =>
              slot.slotId === currentSlotForParticipant.slotId
                ? withParticipantAt(slot, currentParticipantIndex, participant)
                : slot
            ));
          }
          setIsParticipantModalOpen(false);
          setCurrentSlotForParticipant(null);
          setCurrentParticipantIndex(0);
        }}
        onSaveParticipant={handleSaveParticipant}
        participantIndex={
          currentSlotForParticipant && participantsRequiredFor(currentSlotForParticipant.categoryId) > 1
            ? currentParticipantIndex + 1
            : undefined
        }
        slotInfo={currentSlotForParticipant ? `${currentSlotForParticipant.categoryName} - ${formatTime(currentSlotForParticipant.startTime)}, ${formatDateDisplay(new Date(currentSlotForParticipant.date + 'T00:00:00'))}` : undefined}
      />

      {/* 👤 Participant Modal - Pack */}
      <ParticipantModal
        open={isPackParticipantModalOpen}
        onClose={() => {
          setIsPackParticipantModalOpen(false);
          setCurrentPackSlotForParticipant(null);
          setCurrentParticipantIndex(0);
        }}
        onConfirm={(participant) => {
          if (currentPackSlotForParticipant) {
            // Mettre à jour le participant n° currentParticipantIndex du créneau
            setSelectedPackSlots(selectedPackSlots.map(slot =>
              slot.slotId === currentPackSlotForParticipant.slotId
                ? withParticipantAt(slot, currentParticipantIndex, participant)
                : slot
            ));
          }
          setIsPackParticipantModalOpen(false);
          setCurrentPackSlotForParticipant(null);
          setCurrentParticipantIndex(0);
        }}
        onApplyToAll={(participant) => {
          // 👤 Appliquer le participant au 1er slot de TOUS les créneaux du pack
          setSelectedPackSlots(selectedPackSlots.map(slot =>
            withParticipantAt(slot, 0, participant)
          ));
          setIsPackParticipantModalOpen(false);
          setCurrentPackSlotForParticipant(null);
          setCurrentParticipantIndex(0);
        }}
        onSaveParticipant={handleSaveParticipant}
        isPackModal={true}
        participantIndex={
          currentPackSlotForParticipant && participantsRequiredFor(currentPackSlotForParticipant.categoryId) > 1
            ? currentParticipantIndex + 1
            : undefined
        }
        slotInfo={currentPackSlotForParticipant ? `${currentPackSlotForParticipant.categoryName} - ${formatTime(currentPackSlotForParticipant.startTime)}, ${formatDateDisplay(new Date(currentPackSlotForParticipant.date + 'T00:00:00'))}` : undefined}
      />
    </div>
  );
}
