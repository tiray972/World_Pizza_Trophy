import { Category, Slot, User, Product, Voucher, WPTEvent, Payment } from "@/types/firestore";
import { Timestamp } from "firebase/firestore";

// Helper to create timestamp from JS Date
const toTimestamp = (date: Date) => Timestamp.fromDate(date);

// --- DATES SETUP (2025) ---
const EVENT_YEAR = 2025;
const day1 = new Date(2025, 10, 4); // 4 Nov 2025
const day2 = new Date(2025, 10, 5); // 5 Nov 2025
const regDeadline = new Date(2025, 9, 20); // 20 Oct 2025

const day1ISO = "2025-11-04";
const day2ISO = "2025-11-05";

// --- EVENTS ---
export const MOCK_EVENTS: WPTEvent[] = [
  {
    id: 'evt_2025',
    name: 'World Pizza Trophy 2025',
    eventYear: 2025,
    eventStartDate: toTimestamp(day1),
    eventEndDate: toTimestamp(day2),
    registrationDeadline: toTimestamp(regDeadline),
    status: 'open',
  },
  {
    id: 'evt_2026',
    name: 'World Pizza Trophy 2026',
    eventYear: 2026,
    eventStartDate: toTimestamp(new Date(2026, 10, 3)),
    eventEndDate: toTimestamp(new Date(2026, 10, 4)),
    registrationDeadline: toTimestamp(new Date(2026, 9, 20)),
    status: 'draft',
  }
];

// --- WPT DEFAULT TEMPLATE ---
// REQUIRED: This configuration corresponds to the standard World Pizza Trophy setup.
// It is hardcoded to ensure consistency for all future events initialized with "Default Template".
// DO NOT MODIFY without explicit approval from event organizers.
export const WPT_DEFAULT_TEMPLATE_CATEGORIES: Omit<Category, "id" | "eventId" | "activeDates">[] = [
  { name: 'Pizza Classique', description: 'La tradition italienne.', rules: 'Diamètre min 29cm.', unitPrice: 120, maxSlots: 60, durationMinutes: 15, isActive: true },
  { name: 'Calzone', description: 'Le classique replié.', unitPrice: 100, maxSlots: 30, durationMinutes: 15, isActive: true },
  { name: 'Pizza Dessert', description: 'Créations sucrées.', unitPrice: 130, maxSlots: 30, durationMinutes: 15, isActive: true },
  { name: 'Napolitaine', description: 'Vera Pizza Napoletana.', unitPrice: 180, maxSlots: 20, durationMinutes: 15, isActive: true },
  { name: 'Focaccia', description: 'Pain plat à l’huile d’olive.', unitPrice: 80, maxSlots: 20, durationMinutes: 15, isActive: true },
  { name: 'Pasta', description: 'Travail de la pâte.', unitPrice: 90, maxSlots: 20, durationMinutes: 15, isActive: true },
  { name: 'Pizza Douée', description: 'Compétition en duo.', unitPrice: 200, maxSlots: 10, durationMinutes: 20, isActive: true },
  { name: 'Rapidité', description: 'Vitesse et précision.', unitPrice: 110, maxSlots: 20, durationMinutes: 5, isActive: true },
  { name: 'Freestyle', description: 'Créativité totale.', unitPrice: 140, maxSlots: 20, durationMinutes: 10, isActive: true },
  { name: 'Large', description: 'Pizza grand format.', unitPrice: 150, maxSlots: 20, durationMinutes: 20, isActive: true },
  { name: 'Teglia', description: 'Pizza en plaque.', unitPrice: 150, maxSlots: 25, durationMinutes: 15, isActive: true },
  { name: 'Pala', description: 'Pizza alla pala.', unitPrice: 150, maxSlots: 25, durationMinutes: 15, isActive: true },
];

export const WPT_DEFAULT_TEMPLATE_PRODUCTS: Omit<Product, "id" | "eventId">[] = [
  {
    name: 'Pack Compétiteur OR',
    description: '3 catégories + repas VIP',
    stripePriceId: '', // Placeholder: Must be updated in Settings after creation if Stripe ID differs
    unitAmount: 30000, 
    slotsRequired: 3,
    isPack: true,
    includesMeal: true,
    isActive: true,
  },
  {
    name: 'Pack Duo',
    description: '2 catégories pour 2 personnes',
    stripePriceId: '', // Placeholder
    unitAmount: 18000, 
    slotsRequired: 2,
    isPack: true,
    includesMeal: false,
    isActive: true,
  }
];

// --- CATEGORY TEMPLATES (Alias for legacy or generic use) ---
export const CATEGORY_TEMPLATES = WPT_DEFAULT_TEMPLATE_CATEGORIES;

// --- INITIAL CATEGORIES (Linked to 2025) ---
export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat_classique',
    eventId: 'evt_2025',
    name: 'Pizza Classique',
    description: 'La tradition italienne.',
    rules: 'No pre-cooked dough allowed.',
    unitPrice: 120,
    maxSlots: 60,
    durationMinutes: 15, 
    activeDates: [day1ISO, day2ISO],
    isActive: true,
  },
  {
    id: 'cat_calzone',
    eventId: 'evt_2025',
    name: 'Calzone',
    description: 'Le classique replié.',
    unitPrice: 100,
    maxSlots: 30,
    durationMinutes: 15,
    activeDates: [day1ISO, day2ISO],
    isActive: true,
  },
  {
    id: 'cat_dessert',
    eventId: 'evt_2025',
    name: 'Pizza Dessert',
    description: 'Créations sucrées.',
    unitPrice: 130,
    maxSlots: 30,
    durationMinutes: 15,
    activeDates: [day1ISO, day2ISO],
    isActive: true,
  },
  {
    id: 'cat_napo',
    eventId: 'evt_2025',
    name: 'Napolitaine',
    description: 'Vera Pizza Napoletana.',
    unitPrice: 180,
    maxSlots: 20,
    durationMinutes: 15,
    activeDates: [day1ISO],
    isActive: true,
  },
  {
    id: 'cat_focaccia',
    eventId: 'evt_2025',
    name: 'Focaccia',
    description: 'Pain plat à l’huile d’olive.',
    unitPrice: 80,
    maxSlots: 20,
    durationMinutes: 15,
    activeDates: [day2ISO],
    isActive: true,
  },
  {
    id: 'cat_pasta',
    eventId: 'evt_2025',
    name: 'Pasta',
    description: 'Travail de la pâte.',
    unitPrice: 90,
    maxSlots: 20,
    durationMinutes: 15,
    activeDates: [day1ISO],
    isActive: true,
  },
  {
    id: 'cat_due',
    eventId: 'evt_2025',
    name: 'Pizza Douée',
    description: 'Compétition en duo.',
    unitPrice: 200,
    maxSlots: 10,
    durationMinutes: 20,
    activeDates: [day2ISO],
    isActive: true,
  },
  {
    id: 'cat_rapidite',
    eventId: 'evt_2025',
    name: 'Rapidité',
    description: 'Vitesse et précision.',
    unitPrice: 110,
    maxSlots: 20,
    durationMinutes: 5,
    activeDates: [day2ISO],
    isActive: true,
  },
  {
    id: 'cat_freestyle',
    eventId: 'evt_2025',
    name: 'Freestyle',
    description: 'Créativité totale.',
    unitPrice: 140,
    maxSlots: 20,
    durationMinutes: 10,
    activeDates: [day2ISO],
    isActive: true,
  },
  {
    id: 'cat_large',
    eventId: 'evt_2025',
    name: 'Large',
    description: 'Pizza grand format.',
    unitPrice: 150,
    maxSlots: 20,
    durationMinutes: 20,
    activeDates: [day2ISO],
    isActive: true,
  },
  {
    id: 'cat_teglia',
    eventId: 'evt_2025',
    name: 'Teglia',
    description: 'Pizza en plaque.',
    unitPrice: 150,
    maxSlots: 25,
    durationMinutes: 15,
    activeDates: [day1ISO],
    isActive: true,
  },
  {
    id: 'cat_pala',
    eventId: 'evt_2025',
    name: 'Pala',
    description: 'Pizza alla pala.',
    unitPrice: 150,
    maxSlots: 25,
    durationMinutes: 15,
    activeDates: [day2ISO],
    isActive: true,
  },
];

// --- PRODUCTS ---
export const MOCK_PRODUCTS: Product[] = [
  // 2025 Products
  {
    id: 'pack_gold_25',
    eventId: 'evt_2025',
    name: 'Pack Compétiteur OR 2025',
    description: '3 catégories + repas VIP',
    stripePriceId: 'price_gold_25',
    unitAmount: 30000, 
    slotsRequired: 3,
    isPack: true,
    includesMeal: true,
    isActive: true,
  },
  {
    id: 'pack_duo_25',
    eventId: 'evt_2025',
    name: 'Pack Duo 2025',
    description: '2 catégories pour 2 personnes',
    stripePriceId: 'price_duo_25',
    unitAmount: 18000, 
    slotsRequired: 2,
    isPack: true,
    includesMeal: false,
    isActive: true,
  },
  // 2026 Products
  {
    id: 'pack_gold_26',
    eventId: 'evt_2026',
    name: 'Pack Compétiteur OR 2026',
    description: '3 catégories + repas VIP (Early Bird)',
    stripePriceId: 'price_gold_26',
    unitAmount: 32000, 
    slotsRequired: 3,
    isPack: true,
    includesMeal: true,
    isActive: true,
  },
];

// --- VOUCHERS ---
export const MOCK_VOUCHERS: Voucher[] = [
  { 
    id: "v1", 
    eventId: 'evt_2025',
    code: "WELCOME2025", 
    productId: "pack_gold_25", 
    isSingleUse: false, 
    isUsed: false,
    userId: null,
    expiresAt: Timestamp.fromDate(new Date("2024-12-31")),
    createdAt: Timestamp.now()
  },
  { 
    id: "v2", 
    eventId: 'evt_2026',
    code: "EARLYBIRD26", 
    productId: "pack_gold_26", 
    isSingleUse: false, 
    isUsed: false,
    userId: null,
    expiresAt: Timestamp.fromDate(new Date("2025-12-31")),
    createdAt: Timestamp.now()
  }
];

// --- PAYMENTS (MOCK) ---
export const MOCK_PAYMENTS: Payment[] = [
    // 1. Mario Rossi - Correctly Paid via Stripe
    {
        id: "pay_001",
        eventId: "evt_2025",
        userId: "u1",
        stripeSessionId: "sess_12345",
        amount: 30000,
        status: "paid",
        source: "stripe",
        slotIds: [], // In real app, these would be populated
        isPack: true,
        packName: "Pack Compétiteur OR 2025",
        metadata: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    },
    // 2. Luigi Verdi - Paid via Admin Manual, but let's simulate a sync issue in the data
    // Payment exists and is paid, but let's assume the user status (below) might be out of sync
    {
        id: "pay_002",
        eventId: "evt_2025",
        userId: "u2",
        stripeSessionId: null,
        amount: 18000,
        status: "paid",
        source: "admin",
        slotIds: [],
        isPack: true,
        packName: "Pack Duo 2025",
        metadata: { note: "Paid cash on site" },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    },
    // 3. John Doe - Unpaid in registration, but here is a failed payment attempt
    {
        id: "pay_003",
        eventId: "evt_2025",
        userId: "u3",
        stripeSessionId: "sess_failed_999",
        amount: 30000,
        status: "failed",
        source: "stripe",
        slotIds: [],
        isPack: true,
        packName: "Pack Compétiteur OR 2025",
        metadata: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    }
];

// --- USERS ---
export const INITIAL_USERS: User[] = [
  { 
    id: "u1", 
    firstName: "Mario", 
    lastName: "Rossi", 
    email: "mario@pizzapro.com", 
    country: "Italy",
    phone: "+39 123 456 7890",
    role: "user",
    createdAt: Timestamp.now(),
    registrations: {
      'evt_2025': {
        paid: true,
        paymentId: "pay_001",
        categoryIds: ["cat_classique"],
        registeredAt: Timestamp.now()
      }
    }
  },
  { 
    id: "u2", 
    firstName: "Luigi", 
    lastName: "Verdi", 
    email: "luigi@napoli.it", 
    country: "Italy",
    phone: "+39 098 765 4321",
    role: "user",
    createdAt: Timestamp.now(),
    registrations: {
      'evt_2025': {
        paid: true, // Synced correctly
        paymentId: "pay_002",
        categoryIds: ["cat_napo"],
        registeredAt: Timestamp.now()
      },
      'evt_2026': {
        paid: false, 
        categoryIds: ["cat_napo"],
        registeredAt: Timestamp.now()
      }
    }
  },
  { 
    id: "u3", 
    firstName: "John", 
    lastName: "Doe", 
    email: "john@usapizza.com", 
    country: "USA",
    phone: "+1 555 0199",
    role: "user",
    createdAt: Timestamp.now(),
    registrations: {
      'evt_2025': {
        paid: false, // Correctly unpaid as payment failed
        categoryIds: ["cat_freestyle"],
        registeredAt: Timestamp.now()
      }
    }
  },
  // INCONSISTENCY SIMULATION
  {
      id: "u4",
      firstName: "Phantom",
      lastName: "Pay",
      email: "phantom@issue.com",
      country: "France",
      phone: "000",
      role: "user",
      createdAt: Timestamp.now(),
      registrations: {
          'evt_2025': {
              paid: false, // ERROR: Should be TRUE because I will add a payment for him dynamically or via logic
              categoryIds: [],
              registeredAt: Timestamp.now()
          }
      }
  }
];

// Injecting a payment for Phantom Pay to demonstrate "Paid but status Unpaid" issue
MOCK_PAYMENTS.push({
    id: "pay_004",
    eventId: "evt_2025",
    userId: "u4",
    stripeSessionId: "sess_forgotten",
    amount: 30000,
    status: "paid",
    source: "stripe",
    slotIds: [],
    isPack: true,
    packName: "Pack Gold",
    metadata: {},
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
});


// --- GENERATE MOCK SLOTS ---
const createSlot = (
  idStr: string, 
  catId: string, 
  dayStr: string, 
  hour: number, 
  minute: number, 
  duration: number
): Slot => {
  const [y, m, d] = dayStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, hour, minute);
  const end = new Date(start.getTime() + duration * 60000);

  return {
    id: idStr,
    eventId: 'evt_2025', // Linked to the 2025 event
    categoryId: catId,
    date: dayStr,
    startTime: toTimestamp(start),
    endTime: toTimestamp(end),
    status: 'available',
    stripeSessionId: null
  };
};

const generatedSlots: Slot[] = [];

// Classique (Both Days)
generatedSlots.push(createSlot('s_cla_1', 'cat_classique', day1ISO, 9, 0, 15));
generatedSlots.push(createSlot('s_cla_2', 'cat_classique', day1ISO, 9, 15, 15));
generatedSlots.push(createSlot('s_cla_3', 'cat_classique', day2ISO, 10, 0, 15));

// Calzone (Both Days)
generatedSlots.push(createSlot('s_cal_1', 'cat_calzone', day1ISO, 10, 0, 15));
generatedSlots.push(createSlot('s_cal_2', 'cat_calzone', day2ISO, 11, 0, 15));

// Dessert (Both Days)
generatedSlots.push(createSlot('s_des_1', 'cat_dessert', day1ISO, 14, 0, 15));
generatedSlots.push(createSlot('s_des_2', 'cat_dessert', day2ISO, 14, 30, 15));

// Napo (Day 1)
generatedSlots.push(createSlot('s_nap_1', 'cat_napo', day1ISO, 11, 0, 15));
generatedSlots.push(createSlot('s_nap_2', 'cat_napo', day1ISO, 11, 15, 15));
generatedSlots.push(createSlot('s_nap_3', 'cat_napo', day1ISO, 11, 30, 15));

// Pasta (Day 1)
generatedSlots.push(createSlot('s_pas_1', 'cat_pasta', day1ISO, 12, 0, 15));
generatedSlots.push(createSlot('s_pas_2', 'cat_pasta', day1ISO, 12, 15, 15));

// Teglia (Day 1)
generatedSlots.push(createSlot('s_teg_1', 'cat_teglia', day1ISO, 15, 0, 15));
generatedSlots.push(createSlot('s_teg_2', 'cat_teglia', day1ISO, 15, 15, 15));

// Focaccia (Day 2)
generatedSlots.push(createSlot('s_foc_1', 'cat_focaccia', day2ISO, 9, 0, 15));
generatedSlots.push(createSlot('s_foc_2', 'cat_focaccia', day2ISO, 9, 15, 15));

// Douée (Day 2)
generatedSlots.push(createSlot('s_due_1', 'cat_due', day2ISO, 13, 0, 20));
generatedSlots.push(createSlot('s_due_2', 'cat_due', day2ISO, 13, 20, 20));

// Rapidité (Day 2)
generatedSlots.push(createSlot('s_rap_1', 'cat_rapidite', day2ISO, 16, 0, 5));
generatedSlots.push(createSlot('s_rap_2', 'cat_rapidite', day2ISO, 16, 5, 5));
generatedSlots.push(createSlot('s_rap_3', 'cat_rapidite', day2ISO, 16, 10, 5));

// Freestyle (Day 2)
generatedSlots.push(createSlot('s_fre_1', 'cat_freestyle', day2ISO, 17, 0, 10));
generatedSlots.push(createSlot('s_fre_2', 'cat_freestyle', day2ISO, 17, 10, 10));

// Large (Day 2)
generatedSlots.push(createSlot('s_lar_1', 'cat_large', day2ISO, 15, 0, 20));
generatedSlots.push(createSlot('s_lar_2', 'cat_large', day2ISO, 15, 20, 20));

// Pala (Day 2)
generatedSlots.push(createSlot('s_pal_1', 'cat_pala', day2ISO, 12, 0, 15));
generatedSlots.push(createSlot('s_pal_2', 'cat_pala', day2ISO, 12, 15, 15));

export const INITIAL_SLOTS: Slot[] = generatedSlots;
