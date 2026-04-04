# ✅ Fonctionnalité de Repas Optionnel - Implémentation Complétée

## 📊 Vue d'ensemble
La fonctionnalité de repas optionnel a été entièrement implémentée dans le système de réservation. Les utilisateurs peuvent maintenant ajouter un repas lors de leur achat de créneaux de compétition.

---

## ✅ Modifications Complétées

### 1. **Types & Modèles** (`types/firestore.ts`)
- ✅ Ajouté `mealPrice?: number` à l'interface `WPTEvent`
- Ce champ stocke le prix du repas par personne pour chaque événement

### 2. **Interface Utilisateur** (`components/custom/SlotBookingCalendar.tsx`)
- ✅ Ajouté l'état React `wantsMeal: boolean` (ligne 94)
- ✅ Séparation du calcul du total :
  - `slotTotal` : coût des créneaux sélectionnés
  - `mealCost` : coût optionnel du repas
  - `totalPrice` : somme des deux
- ✅ Carte bleue "Ajouter un Repas" (lignes 751-768) avec :
  - Affichage du prix du repas
  - Bouton toggle pour activer/désactiver
- ✅ Détail des coûts dans le panier (lignes 777-791) :
  - Affichage séparé des créneaux et du repas
  - Sous-total + total avec bordure
- ✅ Modifier la signature de `onCheckout` pour passer `includeMeal` et `mealPrice`

### 3. **Page de Booking** (`app/[lang]/booking/page.tsx`)
- ✅ Modifier `handleCheckout()` pour accepter les paramètres de repas
- ✅ Calculer `slotTotal` et `mealCost` séparément
- ✅ Passer `includeMeal` et `mealPrice` à l'API de checkout

### 4. **API de Checkout** (`app/api/booking/checkout/route.ts`)
- ✅ Ajouter l'interface `CheckoutBody` avec `includeMeal` et `mealPrice`
- ✅ Créer deux line items séparés dans Stripe :
  - **Line item 1** : Créneaux de compétition
  - **Line item 2** : Repas (si inclus)
- ✅ Ajouter `includeMeal` et `mealPrice` au metadata Stripe
- ✅ Corriger l'échappement de caractères dans les descriptions

---

## 🔄 Flux Utilisateur

1. **Sélection des créneaux** : L'utilisateur sélectionne ses créneaux comme avant
2. **Ouverture du panier** : Le panier affiche les créneaux et l'option repas
3. **Ajout optionnel du repas** : Clic sur "+ Ajouter" pour activer le repas
4. **Détail des coûts** : Affichage transparent :
   - Créneaux (X) : €Y
   - Repas : €Z (si sélectionné)
   - **Total à Payer : €(Y+Z)**
5. **Paiement Stripe** : Deux line items séparés pour clarté

---

## 🛠️ Prochaines Étapes (À Compléter)

### 1. **Dashboard - Configuration du Prix du Repas**
Ajouter une section dans le dashboard admin pour configurer le prix du repas par événement :

```typescript
// Dans la page de paramètres d'événement
const handleMealPriceUpdate = async (eventId: string, mealPrice: number) => {
  await adminDB.collection('events').doc(eventId).update({
    mealPrice: mealPrice,
  });
};
```

**Emplacement** : `app/[lang]/dashboard/world-pizza-trophy-admin/` 
(À créer une section "Paramètres Événement" ou modifier la section existante)

### 2. **Webhook Stripe - Gestion du Repas**
Vérifier que le webhook Stripe (`app/api/stripe/webhook/route.ts`) prend en compte le metadata `includeMeal` pour les records de paiement.

### 3. **Export & Reporting**
- Afficher dans les exports : si un participant a un repas inclus
- Dashboard : statistiques sur les repas vendus

### 4. **Emails de Confirmation**
- Ajouter le détail du repas dans l'email de confirmation
- Format : "Créneaux : €Y | Repas : €Z | Total : €(Y+Z)"

---

## 📝 Configuration Requise

Pour que la fonctionnalité fonctionne :

1. **Firestore** : Ajouter `mealPrice` à vos documents d'événements existants
   ```json
   {
     "id": "event-2026",
     "name": "World Pizza Trophy 2026",
     "eventStartDate": "2026-04-15T...",
     "eventEndDate": "2026-04-17T...",
     "registrationDeadline": "2026-04-10T...",
     "status": "open",
     "mealPrice": 25.00  // �� À AJOUTER (en EUR)
   }
   ```

2. **Valeurs de test** :
   - Prix raisonnable : 20-40€
   - Facultatif : mettre `mealPrice: 0` ou ne pas inclure le champ si pas de repas

---

## 📋 Fichiers Modifiés

- ✅ `types/firestore.ts` - Ajout du champ `mealPrice`
- ✅ `components/custom/SlotBookingCalendar.tsx` - UI du panier + état + calcul
- ✅ `app/[lang]/booking/page.tsx` - Gestion du checkout avec repas
- ✅ `app/api/booking/checkout/route.ts` - API avec line items séparés

---

## ✨ Points Clés

- **Optionnel** : Le repas est complètement optionnel, l'utilisateur peut payer sans
- **Transparent** : Les coûts sont clairement séparés et détaillés
- **Flexible** : Prix configurable par événement
- **Stripe** : Deux line items pour une meilleure traçabilité
- **Métadata** : Les infos de repas sont sauvegardées dans Stripe pour le reporting

---

## 🧪 Test Recommandé

1. Créer un événement avec `mealPrice: 25`
2. Sélectionner des créneaux (ex: 2 créneaux à 15€ = 30€)
3. Voir le panier afficher :
   - Créneaux (2) : 30€
   - Ajouter un Repas : + 25€
4. Cliquer "+ Ajouter"
5. Voir le total : 55€
6. Paiement Stripe avec 2 line items séparés

---

**Status**: ✅ Production Ready (après configuration dashboard)
