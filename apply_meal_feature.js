const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components/custom/SlotBookingCalendar.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Étape 1: Ajouter l'état wantsMeal après currentSlotForParticipant
const participant_state = `  const [currentSlotForParticipant, setCurrentSlotForParticipant] = useState<SelectedSlot | null>(null);

  // 🔧 DEBUG LOG: Track prop changes`;

const meal_state = `  const [currentSlotForParticipant, setCurrentSlotForParticipant] = useState<SelectedSlot | null>(null);

  // 🍽️ Meal state
  const [wantsMeal, setWantsMeal] = useState(false);

  // 🔧 DEBUG LOG: Track prop changes`;

content = content.replace(participant_state, meal_state);

// Étape 2: Modifier renderCartSheetContent pour calculer slotTotal et mealCost séparément
const old_calculation = `  const renderCartSheetContent = () => {
    const totalPrice = selectedSlots.reduce((sum, slot) => {
      const category = categories.find(c => c.id === slot.categoryId);
      return sum + (category?.unitPrice || 0);
    }, 0);`;

const new_calculation = `  const renderCartSheetContent = () => {
    // Calculer les totaux séparément
    const slotTotal = selectedSlots.reduce((sum, slot) => {
      const category = categories.find(c => c.id === slot.categoryId);
      return sum + (category?.unitPrice || 0);
    }, 0);
    
    const mealPrice = settings.mealPrice || 0;
    const mealCost = wantsMeal && mealPrice > 0 ? mealPrice : 0;
    const totalPrice = slotTotal + mealCost;`;

content = content.replace(old_calculation, new_calculation);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Étapes 1 et 2 appliquées avec succès');
