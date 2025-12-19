'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slot, Category, WPTEvent, Product } from '@/types/firestore';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ShoppingCartIcon, XCircleIcon, ClockIcon, PizzaIcon, PackageIcon, UtensilsCrossedIcon, CheckCircleIcon, ArrowLeftIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';

interface SelectedSlot {
  slotId: string;
  categoryId: string;
  categoryName: string;
  startTime: Date;
  date: string;
}

interface SelectedPackSlot extends SelectedSlot {
  // Aucune propriété supplémentaire
}

interface SlotBookingViewProps {
  availableSlots: Slot[];
  categories: Category[];
  settings: WPTEvent;
  products: Product[];
  registrationClosed: boolean;
  onCheckout: (slots: SelectedSlot[]) => void;
  onPackCheckout: (product: Product, slots: SelectedPackSlot[]) => void;
}

const formatTime = (date: Date): string => 
  date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const formatDateDisplay = (date: Date): string =>
  date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

const formatDateISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  // 🔧 DEBUG LOG: Track prop changes
  useEffect(() => {
    console.log('📊 [SlotBookingView] Props updated:');
    console.log(`   - availableSlots: ${availableSlots.length} slots`);
    console.log(`   - categories: ${categories.length} categories`);
    console.log(`   - State: activeCategoryId=${activeCategoryId}, activeDate=${activeDate}`);
  }, [availableSlots, categories, activeCategoryId, activeDate]);

  const eventStartDate = useMemo(() => new Date(settings.eventStartDate), [settings.eventStartDate]);
  const registrationDeadlineDate = useMemo(() => new Date(settings.registrationDeadline), [settings.registrationDeadline]);

  const activeCategory = useMemo(() => {
    const id = isPackSelectionSheetOpen ? activePackCategoryId : activeCategoryId;
    return id ? categories.find(c => c.id === id) || null : null;
  }, [activeCategoryId, activePackCategoryId, categories, isPackSelectionSheetOpen]);

  // 🔧 FIX: Correct filter logic with proper debugging
  const filteredSlots = useMemo(() => {
    // Determine which category and date we're filtering for
    const currentActiveCategoryId = isPackSelectionSheetOpen ? activePackCategoryId : activeCategoryId;
    const currentActiveDate = activeDate; // Use activeDate directly (works for both modes)

    // 🔧 DEBUG: Log filter inputs
    if (currentActiveCategoryId && currentActiveDate) {
      console.log(`🔍 [filteredSlots] Filtering: categoryId=${currentActiveCategoryId}, date=${currentActiveDate}`);
      console.log(`   - Total slots in props: ${availableSlots.length}`);
    }

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

        // Log first non-matching slot for debugging
        if (!categoryMatch || !dateMatch || !statusMatch) {
          console.log(`   ❌ Slot ${slot.id}: categoryMatch=${categoryMatch}, dateMatch=${dateMatch}, statusMatch=${slot.status}`);
        }

        return categoryMatch && dateMatch && statusMatch && notInStandardCart && notInPackSelection;
      })
      .sort((a, b) => {
        const timeA = new Date(a.startTime).getTime();
        const timeB = new Date(b.startTime).getTime();
        return timeA - timeB;
      });

    console.log(`   ✅ Filtered result: ${filtered.length} slots match`);
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
    const startTime = new Date(slot.startTime);

    if (isCurrentlySelected) {
      setSelectedSlots(selectedSlots.filter(s => s.slotId !== slot.id));
    } else {
      const newSlot: SelectedSlot = {
        slotId: slot.id,
        categoryId: slot.categoryId,
        categoryName: getCategoryName(slot.categoryId, categories),
        startTime,
        date: slot.date,
      };
      setSelectedSlots([...selectedSlots, newSlot]);
    }
  };

  const handleTogglePackSlotSelect = (slot: Slot) => {
    if (!packToPurchase) return;

    const isCurrentlySelected = selectedPackSlots.some(s => s.slotId === slot.id);
    const startTime = new Date(slot.startTime);

    if (isCurrentlySelected) {
      setSelectedPackSlots(selectedPackSlots.filter(s => s.slotId !== slot.id));
    } else {
      if (selectedPackSlots.length < packToPurchase.slotsRequired) {
        const newSlot: SelectedPackSlot = {
          slotId: slot.id,
          categoryId: slot.categoryId,
          categoryName: getCategoryName(slot.categoryId, categories),
          startTime,
          date: slot.date,
        };
        setSelectedPackSlots([...selectedPackSlots, newSlot]);
      }
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
            <CardFooter className="p-3 pt-0">
              <Badge variant="secondary" className="text-xs">
                <CalendarIcon className="w-3 h-3 mr-1" />
                {datesDisplay}
              </Badge>
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
    const availablePackCategories = categories.filter(c => c.activeDates.length > 0);

    return (
      <SheetContent side="bottom" className="sm:max-w-xl h-[95vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Configuration du Pack : {packToPurchase.name}</SheetTitle>
          <SheetDescription>
            Veuillez sélectionner {slotsNeeded} créneau(x) pour valider votre achat de pack.
          </SheetDescription>
        </SheetHeader>

        <div
          className={`p-3 rounded-lg ${
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

        {!activePackCategoryId ? (
          <div className="grow overflow-y-auto space-y-4">
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
          <div className="grow flex flex-col">
            <Button
              variant="ghost"
              className="mb-4 self-start"
              onClick={() => setActivePackCategoryId(null)}
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Retour à la sélection des catégories
            </Button>

            <h3 className="font-bold text-lg mb-4">
              2. Choisissez les Créneaux pour {activeCategory?.name}
            </h3>

            {activeCategory && activeCategory.activeDates.length > 0 ? (
              <Tabs
                value={activeDate || ''}
                onValueChange={setActiveDate}
                className="w-full grow flex flex-col"
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

                <div className="grow overflow-y-auto pr-2">
                  {activeCategory.activeDates.map(dateStr => (
                    <TabsContent key={dateStr} value={dateStr} className="mt-0">
                      {filteredSlots.length > 0 ||
                      selectedPackSlots.some(s => s.categoryId === activePackCategoryId && s.date === dateStr) ? (
                        <div className="space-y-2">
                          {selectedPackSlots
                            .filter(s => s.categoryId === activePackCategoryId && s.date === dateStr)
                            .map(slot => (
                              <Button
                                key={slot.slotId}
                                variant="default"
                                className="w-full justify-start transition-colors bg-primary/80 hover:bg-primary"
                                onClick={() =>
                                  handleTogglePackSlotSelect(
                                    availableSlots.find(s => s.id === slot.slotId)!
                                  )
                                }
                              >
                                <CheckCircleIcon className="w-4 h-4 mr-2" />
                                <span className="font-semibold">
                                  {formatTime(slot.startTime)} (Sélectionné)
                                </span>
                                <Badge className="ml-auto bg-white text-primary hover:bg-white/90">
                                  Retirer
                                </Badge>
                              </Button>
                            ))}

                          {filteredSlots.map(slot => {
                            const time = new Date(slot.startTime);
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
                        </div>
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

        <SheetFooter className="mt-4 shrink-0">
          <Button
            type="button"
            className="w-full h-12 text-lg"
            disabled={!selectionComplete}
            onClick={() => {
              onPackCheckout(packToPurchase, selectedPackSlots);
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
      <SheetContent side="bottom" className="sm:max-w-xl h-[90vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>{activeCategory.name}</SheetTitle>
          <SheetDescription>
            Sélectionnez vos créneaux horaires pour cette catégorie.
          </SheetDescription>
        </SheetHeader>

        {activeCategory.activeDates.length > 0 ? (
          <Tabs
            value={activeDate || ''}
            onValueChange={setActiveDate}
            className="w-full grow flex flex-col"
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

            <div className="grow overflow-y-auto pr-2">
              {activeCategory.activeDates.map(dateStr => (
                <TabsContent key={dateStr} value={dateStr} className="mt-0">
                  {filteredSlots.length > 0 ? (
                    <div className="space-y-2">
                      {filteredSlots.map(slot => {
                        const isSelected = selectedSlots.some(s => s.slotId === slot.id);
                        const time = new Date(slot.startTime);

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
                    </div>
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

        <SheetFooter className="mt-4 shrink-0">
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

        <div className="py-4 space-y-3 grow overflow-y-auto pr-2">
          {selectedSlots.length === 0 ? (
            <div className="p-8 text-center text-gray-500 border border-dashed rounded-lg">
              Votre panier est vide. Sélectionnez une catégorie pour commencer.
            </div>
          ) : (
            selectedSlots.map(slot => {
              const dateObj = new Date(slot.date + 'T00:00:00');
              const displayDate = formatDateDisplay(dateObj);

              return (
                <Card key={slot.slotId} className="p-3 flex justify-between items-center bg-gray-50 shadow-sm">
                  <div>
                    <p className="font-semibold">{slot.categoryName}</p>
                    <p className="text-sm text-gray-500 flex items-center">
                      <ClockIcon className="w-3 h-3 mr-1" />
                      {formatTime(slot.startTime)} - {displayDate}
                    </p>
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      handleToggleSelect(availableSlots.find(s => s.id === slot.slotId)!)
                    }
                  >
                    <XCircleIcon className="w-4 h-4" />
                  </Button>
                </Card>
              );
            })
          )}
        </div>

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
              setIsCartSheetOpen(false);
              setSelectedSlots([]);
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

      {renderProductPacks()}

      <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
        <PizzaIcon className="w-6 h-6 mr-2" />
        Catégories de Compétition Individuelles
      </h2>

      {renderCategoryCards()}

      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 transition-transform hover:scale-105"
        onClick={() => setIsCartSheetOpen(true)}
        disabled={selectedSlots.length === 0}
      >
        <ShoppingCartIcon className="w-6 h-6" />
        {selectedSlots.length > 0 && (
          <Badge
            variant="destructive"
            className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3 rounded-full h-6 w-6 flex items-center justify-center font-bold"
          >
            {selectedSlots.length}
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
    </div>
  );
}
