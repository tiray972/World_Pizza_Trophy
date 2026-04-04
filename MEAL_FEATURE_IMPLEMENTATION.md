# Implémentation de la Fonctionnalité de Repas

## 📋 Résumé
Ajouter une option de repas optionnel au panier de réservation pour que les utilisateurs puissent ajouter un repas lors de leur achat de créneaux.

## ✅ Modifications Complétées

### 1. Modèle Firestore (`types/firestore.ts`)
- ✅ Ajouté le champ `mealPrice?: number` à l'interface `WPTEvent`
- Ce champ stocke le prix du repas pour chaque événement

### 2. Composant Booking (`components/custom/SlotBookingCalendar.tsx`)
- ✅ Ajouté l'état `wantsMeal: boolean` pour tracker si l'utilisateur veut un repas

## 🔧 Modifications Restantes

### 3. Modifier `renderCartSheetContent()` dans SlotBookingCalendar.tsx

Remplacer le calcul du `totalPrice` (ligne ~625) par:

```typescript
const renderCartSheetContent = () => {
  const slotTotal = selectedSlots.reduce((sum, slot) => {
    const category = categories.find(c => c.id === slot.categoryId);
    return sum + (category?.unitPrice || 0);
  }, 0);
  
  // Calculer le coût du repas si disponible
  const mealPrice = settings.mealPrice || 0;
  const mealCost = wantsMeal ? mealPrice : 0;
  const totalPrice = slotTotal + mealCost;
  
  // ... rest of the function
```

### 4. Ajouter le bouton "Ajouter Repas" dans le panier

Ajouter avant la section `SheetFooter` (après la liste des slots):

```typescript
{/* 🍽️ Option Repas */}
{settings.mealPrice && settings.mealPrice > 0 && (
  <Card className="p-4 bg-blue-50 border-2 border-blue-200 mb-4">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="font-semibold text-blue-900 flex items-center">
          <UtensilsCrossedIcon className="w-4 h-4 mr-2" />
          Ajouter un Repas
        </p>
        <p className="text-sm text-blue-700">
          {formatPrice(settings.mealPrice)} par personne
        </p>
      </div>
      <Button
        size="sm"
        variant={wantsMeal ? "default" : "outline"}
        className={wantsMeal ? "bg-blue-600 hover:bg-blue-700" : ""}
        onClick={() => setWantsMeal(!wantsMeal)}
      >
        {wantsMeal ? "✓ Inclus" : "+ Ajouter"}
      </Button>
    </div>
  </Card>
)}
```

### 5. Mettre à jour l'affichage du total

Modifier la section du total (ligne ~690) pour afficher les détails:

```typescript
<SheetFooter className="flex-col pt-4 border-t">
  {/* Détail des coûts */}
  <div className="w-full space-y-2 mb-4 text-sm">
    <div className="flex justify-between">
      <span>Créneaux ({selectedSlots.length}):</span>
      <span>{formatPrice(slotTotal)}</span>
    </div>
    {wantsMeal && mealCost > 0 && (
      <div className="flex justify-between text-blue-600 font-semibold">
        <span>Repas:</span>
        <span>{formatPrice(mealCost)}</span>
      </div>
    )}
  </div>

  {/* Total */}
  <div className="w-full flex justify-between items-center text-lg font-bold mb-3 border-t pt-3">
    <span>Total à Payer:</span>
    <span className="text-2xl text-primary">{formatPrice(totalPrice)}</span>
  </div>
  
  {/* ... rest of the footer */}
</SheetFooter>
```

### 6. Modifier l'API de checkout (`app/api/booking/checkout/route.ts`)

Ajouter le champ `includeMeal` au body:

```typescript
interface CheckoutBody {
  slotsToReserve: SlotWithParticipant[];
  userId: string;
  userEmail: string;
  eventId: string;
  totalAmount: number; // Inclus déjà le repas si applicable
  includeMeal: boolean; // Nouveau champ
  mealPrice: number;   // Prix du repas
  lang: string;
}
```

Et mettre à jour la création de session Stripe:

```typescript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [
    {
      price_data: {
        currency: 'eur',
        product_data: {
          name: `Créneaux de Compétition (${slotsToReserve.length})`,
          description: slotsToReserve.length > 0 ? `${slotsToReserve.length} créneaux` : '',
        },
        unit_amount: Math.round((totalAmount - (includeMeal ? mealPrice : 0)) * 100),
      },
      quantity: 1,
    },
    ...(includeMeal && mealPrice > 0 ? [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: 'Repas',
          description: 'Repas pendant l\'événement',
        },
        unit_amount: Math.round(mealPrice * 100),
      },
      quantity: 1,
    }] : []),
  ],
  // ... rest of config
});
```

### 7. Mettre à jour l'appel au checkout depuis la page de booking

Dans `app/[lang]/booking/page.tsx`, modifier l'appel à `fetch('/api/booking/checkout')`:

```typescript
const res = await fetch('/api/booking/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    slotsToReserve: slotsToCheckout,
    userId: user.uid,
    userEmail: user.email,
    eventId: selectedEventId,
    totalAmount: totalAmount,
    includeMeal: wantsMeal,           // ✨ Nouveau
    mealPrice: settings.mealPrice || 0, // ✨ Nouveau
    lang: currentLang,
  }),
});
```

## 📊 Dashboard - Configuration du Prix du Repas

Ajouter une section dans le dashboard pour configurer le prix du repas par événement:

```typescript
// Dans SettingsPage.tsx ou une nouvelle page EventSettingsPage.tsx
const handleMealPriceUpdate = async (eventId: string, mealPrice: number) => {
  await adminDB.collection('events').doc(eventId).update({
    mealPrice: mealPrice,
  });
};
```

## 🔄 Flux Utilisateur

1. ✅ Utilisateur sélectionne des créneaux
2. ✅ Panier s'ouvre
3. ✅ Si `settings.mealPrice > 0`, afficher le bouton "Ajouter Repas"
4. ✅ Clic sur le bouton → `wantsMeal = true`
5. ✅ Total mis à jour avec le coût du repas
6. ✅ Envoyer `includeMeal` et `mealPrice` au checkout
7. ✅ Stripe crée une session avec 2 line items (créneaux + repas)

## 📝 Fichiers à Modifier

- [x] `types/firestore.ts` - Modèle WPTEvent
- [ ] `components/custom/SlotBookingCalendar.tsx` - UI du panier
- [ ] `app/api/booking/checkout/route.ts` - API checkout
- [ ] `app/[lang]/booking/page.tsx` - Appel au checkout
- [ ] Dashboard Settings - Configuration du prix

## ⚠️ Points Importants

- Le `mealPrice` est par événement, pas par créneau
- Le repas est entièrement optionnel (button toggle)
- Afficher le repas comme un line item séparé dans Stripe pour la clarté
- Mettre à jour le `totalAmount` calculé côté client avant d'envoyer

