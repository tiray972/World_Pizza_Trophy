"use client";
import React, { useState, useMemo } from 'react';
import { AdminLayout } from './components/AdminLayout';
import { ViewType, Slot, User, Category, WPTEvent, Product, Voucher, Payment } from './types';
import { Button } from './components/ui/Button';
import { SlotsPage } from './components/SlotsPage';
import { ProductsPage } from './components/ProductsPage';
import { VouchersPage } from './components/VouchersPage';
import { UsersPage } from './components/UsersPage';
import { ExportsPage } from './components/ExportsPage';
import { SettingsPage } from './components/SettingsPage';
import { CategoriesPage } from './components/CategoriesPage';
import { PaymentsPage } from './components/PaymentsPage';
import { CreateEventModal } from './components/CreateEventModal';
import { ThemeProvider } from './components/ThemeProvider';
import { formatCurrency } from './lib/utils';
import { 
  useEvents, 
  useUsers, 
  useSlots, 
  useCategories, 
  useProducts, 
  useVouchers, 
  usePayments,
} from './lib/useFirebase';
// Import direct des templates depuis mockData.ts
import {
  WPT_DEFAULT_TEMPLATE_CATEGORIES,
  WPT_DEFAULT_TEMPLATE_PRODUCTS
} from './lib/mockData';
import { Timestamp } from 'firebase/firestore';

const DashboardStats = ({ 
  slots, 
  users, 
  products,
  eventId 
}: { 
  slots: Slot[], 
  users: User[], 
  products: Product[],
  eventId: string
}) => {
  const registeredUsers = users.filter(u => u.registrations[eventId]);
  const paidUsers = registeredUsers.filter(u => u.registrations[eventId].paid);
  
  const avgProductPrice = products.length > 0 
    ? products.reduce((acc, p) => acc + p.unitAmount, 0) / products.length 
    : 30000;
  
  const estimatedRevenue = (paidUsers.length * avgProductPrice) / 100;
  const totalSlots = slots.length;
  const bookedSlots = slots.filter(s => s.status !== 'available').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <div className="text-sm font-medium tracking-tight text-muted-foreground">Estimated Revenue</div>
          <div className="text-2xl font-bold">{formatCurrency(estimatedRevenue)}</div>
          <div className="text-xs text-muted-foreground mt-1">Based on {paidUsers.length} paid registrations</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <div className="text-sm font-medium tracking-tight text-muted-foreground">Slot Occupancy</div>
          <div className="text-2xl font-bold">{bookedSlots} / {totalSlots}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0}% capacity
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <div className="text-sm font-medium tracking-tight text-muted-foreground">Active Products</div>
          <div className="text-2xl font-bold">{products.length}</div>
          <div className="text-xs text-muted-foreground mt-1">For this event edition</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <div className="text-sm font-medium tracking-tight text-muted-foreground">Competitors</div>
          <div className="text-2xl font-bold">{registeredUsers.length}</div>
          <div className="text-xs text-muted-foreground mt-1">{paidUsers.length} confirmed paid</div>
        </div>
      </div>
      <div className="rounded-xl border bg-card shadow-sm p-12 text-center text-muted-foreground">
         Detailed Analytics Charts would appear here.
      </div>
    </div>
  );
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('slots');
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Firebase hooks - loads data in real-time
  const { events, createEvent, updateEvent } = useEvents();
  const { users, updateUser } = useUsers();
  const { slots, createSlots, updateSlot, deleteSlot, deleteSlotsByDate } = useSlots(selectedEventId);
  const { categories, createCategory, updateCategory, deleteCategory } = useCategories(selectedEventId);
  const { products, createProduct, updateProduct, deleteProduct } = useProducts(selectedEventId);
  const { vouchers, createVoucher, deleteVoucher } = useVouchers(selectedEventId);
  const { payments, updatePayment } = usePayments(selectedEventId);
  
  // Set default event on first load
  React.useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId), [events, selectedEventId]);

  // Filtered data per event
  const eventSlots = useMemo(() => slots, [slots]);
  const eventProducts = useMemo(() => products, [products]);
  const eventVouchers = useMemo(() => vouchers, [vouchers]);
  const eventCategories = useMemo(() => categories, [categories]);

  // --- HANDLERS ---

  const handleUpdateEvent = async (updatedEvent: WPTEvent) => {
    await updateEvent(updatedEvent.id, updatedEvent);
  };

  /**
   * ============================================================================
   * EVENT CREATION WITH TEMPLATE DUPLICATION SYSTEM
   * ============================================================================
   * 
   * This handler manages the complete event creation workflow:
   * 
   * 1️⃣  CREATE NEW EVENT
   *     - New eventId is generated by Firestore (auto-increment)
   *     - Event starts in 'draft' status
   * 
   * 2️⃣  OPTIONAL: DUPLICATE TEMPLATE OR EXISTING EVENT
   *     Based on copyFromEventId:
   *     
   *     a) "default_template" → Duplicate WPT_DEFAULT_TEMPLATE_* from mockData.ts
   *        - Official WPT categories (Classique, Napolitaine, etc.)
   *        - Standard packs (Pack Compétiteur OR, Pack Duo)
   *        - All data is COPIED, not referenced
   * 
   *     b) "<eventId>" → Copy from existing event
   *        - All categories and products from source event
   *        - activeDates are RESET (must be set per event)
   *        - All IDs are regenerated via Firestore
   * 
   *     c) null → Empty event (no categories/products)
   *        - User must manually add all content
   * 
   * 3️⃣  CRITICAL DUPLICATION RULES
   *     ✅ DO:
   *        - Generate NEW ids via Firestore (addDoc returns unique ID)
   *        - Set eventId to newEventId (links data to new event)
   *        - Reset activeDates to [] (must be configured per event)
   *        - Copy all other properties exactly
   * 
   *     ❌ DON'T:
   *        - Reuse old IDs from template or source event
   *        - Link to template IDs in any way
   *        - Use isTemplate or similar flags
   *        - Prevent deletion/editing of duplicated data
   * 
   * 4️⃣  RESULT: FULLY INDEPENDENT DATA
   *     - No relationship with original template or source event
   *     - Can be edited, deleted, or modified freely
   *     - No "locked" or "protected" behavior
   * ============================================================================
   */
  const handleCreateEvent = async (eventData: Omit<WPTEvent, "id" | "status">, copyFromEventId: string | null) => {
    try {
      // Step 1: Create the new event in Firestore (generates unique eventId)
      const newEventId = await createEvent({
        ...eventData,
        status: 'draft',
      });

      // Step 2: Optionally duplicate categories and products
      if (copyFromEventId === 'default_template') {
        // --- DUPLICATE FROM WPT STANDARD TEMPLATE ---
        // Source: WPT_DEFAULT_TEMPLATE_CATEGORIES & WPT_DEFAULT_TEMPLATE_PRODUCTS in mockData.ts
        
        // Categories: duplicate with new IDs and new eventId
        for (const tpl of WPT_DEFAULT_TEMPLATE_CATEGORIES) {
          const newCatData: Omit<Category, 'id'> = {
            name: tpl.name,
            description: tpl.description,
            rules: tpl.rules,
            unitPrice: tpl.unitPrice,
            maxSlots: tpl.maxSlots,
            durationMinutes: tpl.durationMinutes,
            activeDates: [], // Reset for new event (user will set dates later)
            isActive: tpl.isActive,
            eventId: newEventId, // Link to NEW event (not template)
          };
          await createCategory(newCatData);
        }

        // Products: duplicate with new IDs and new eventId
        for (const tpl of WPT_DEFAULT_TEMPLATE_PRODUCTS) {
          const newProdData: Omit<Product, 'id'> = {
            name: tpl.name,
            description: tpl.description,
            stripePriceId: tpl.stripePriceId,
            unitAmount: tpl.unitAmount,
            slotsRequired: tpl.slotsRequired,
            isPack: tpl.isPack,
            includesMeal: tpl.includesMeal,
            isActive: tpl.isActive,
            eventId: newEventId, // Link to NEW event (not template)
          };
          await createProduct(newProdData);
        }
      } else if (copyFromEventId) {
        // --- DUPLICATE FROM EXISTING EVENT ---
        // All categories and products from the source event are copied with new IDs
        
        // Categories: filter by source eventId, duplicate with new IDs
        const sourceCategories = categories.filter(c => c.eventId === copyFromEventId);
        for (const sourceCat of sourceCategories) {
          const newCatData: Omit<Category, 'id'> = {
            name: sourceCat.name,
            description: sourceCat.description,
            rules: sourceCat.rules,
            unitPrice: sourceCat.unitPrice,
            maxSlots: sourceCat.maxSlots,
            durationMinutes: sourceCat.durationMinutes,
            activeDates: [], // Reset dates for new event
            isActive: sourceCat.isActive,
            eventId: newEventId, // Link to NEW event (not source)
          };
          await createCategory(newCatData);
        }

        // Products: filter by source eventId, duplicate with new IDs
        const sourceProducts = products.filter(p => p.eventId === copyFromEventId);
        for (const sourceProd of sourceProducts) {
          const newProdData: Omit<Product, 'id'> = {
            name: sourceProd.name,
            description: sourceProd.description,
            stripePriceId: sourceProd.stripePriceId,
            unitAmount: sourceProd.unitAmount,
            slotsRequired: sourceProd.slotsRequired,
            isPack: sourceProd.isPack,
            includesMeal: sourceProd.includesMeal,
            isActive: sourceProd.isActive,
            eventId: newEventId, // Link to NEW event (not source)
          };
          await createProduct(newProdData);
        }
      }
      // If copyFromEventId is null/empty, skip duplication → empty event

      // Step 3: Select new event and navigate to categories for configuration
      setSelectedEventId(newEventId);
      setActiveView('categories');
    } catch (error) {
      console.error("Failed to create event:", error);
      throw error; // Re-throw so modal can handle error display
    }
  };

  const handleUpdateSlot = async (updatedSlot: Slot) => {
    await updateSlot(updatedSlot.id, updatedSlot);
  };

  const handleUpdateSlotsBulk = async (updatedSlots: Slot[]) => {
    for (const slot of updatedSlots) {
      await updateSlot(slot.id, slot);
    }
  };

  const handleCreateSlots = async (slotsData: Omit<Slot, "id" | "status" | "userId" | "stripeSessionId" | "eventId">[]) => {
    if (!selectedEventId) {
      alert("No event selected. Cannot create slots.");
      return;
    }
    
    const newSlots: Omit<Slot, "id">[] = slotsData.map(data => ({
      ...data,
      eventId: selectedEventId,
      status: 'available' as const,
      stripeSessionId: null,
    }));
    
    await createSlots(newSlots);
  };

  const handleDeleteSlot = async (slotId: string) => {
    await deleteSlot(slotId);
  };

  const handleDeleteDate = async (date: string) => {
    await deleteSlotsByDate(date, selectedEventId);
  };

  const handleCreateProduct = async (productData: Omit<Product, "id">) => {
    await createProduct({
      ...productData,
      eventId: selectedEventId,
    });
  };

  const handleUpdateProduct = async (productId: string, data: Partial<Product>) => {
    await updateProduct(productId, data);
  };

  const handleDeleteProduct = async (productId: string) => {
    await deleteProduct(productId);
  };

  const handleCreateVoucher = async (voucherData: Omit<Voucher, "id">) => {
    await createVoucher({
      ...voucherData,
      eventId: selectedEventId,
    });
  };

  const handleDeleteVoucher = async (voucherId: string) => {
    await deleteVoucher(voucherId);
  };

  const handleUpdateCategory = async (updatedCat: Category) => {
    await updateCategory(updatedCat.id, updatedCat);
  };

  const handleCreateCategory = async (catData: Omit<Category, "id">) => {
    await createCategory({
      ...catData,
      eventId: selectedEventId,
    });
  };

  const handleDeleteCategory = async (catId: string) => {
    await deleteCategory(catId);
  };

  const handleUpdateUser = async (userId: string, data: Partial<User>) => {
    await updateUser(userId, data);
  };

  const handleUpdatePayment = async (paymentId: string, data: Partial<Payment>) => {
    await updatePayment(paymentId, data);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard': 
        return (
          <DashboardStats 
            slots={eventSlots} 
            users={users} 
            products={eventProducts} 
            eventId={selectedEventId} 
          />
        );
      case 'settings': 
        return (
          <SettingsPage 
            event={selectedEvent} 
            onUpdateEvent={handleUpdateEvent} 
            onCreateEvent={() => setIsCreateEventModalOpen(true)}
          />
        );
      case 'categories':
        return (
          <CategoriesPage
            categories={eventCategories}
            slots={eventSlots}
            selectedEventId={selectedEventId}
            onUpdateCategory={handleUpdateCategory}
            onCreateCategory={handleCreateCategory}
            onDeleteCategory={handleDeleteCategory}
          />
        );
      case 'slots': 
        return (
          <SlotsPage 
            slots={eventSlots} 
            users={users} 
            categories={eventCategories}
            selectedEvent={selectedEvent}
            onUpdateSlot={handleUpdateSlot} 
            onCreateSlot={handleCreateSlots}
            onDeleteSlot={handleDeleteSlot}
            onDeleteDate={handleDeleteDate}
          />
        );
      case 'products': 
        return (
          <ProductsPage 
            products={eventProducts} 
            selectedEventId={selectedEventId}
            onCreateProduct={handleCreateProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        );
      case 'vouchers': 
        return (
          <VouchersPage 
            vouchers={eventVouchers} 
            selectedEventId={selectedEventId}
            onCreateVoucher={handleCreateVoucher}
            onDeleteVoucher={handleDeleteVoucher}
          />
        );
      case 'users': 
        return (
          <UsersPage 
            users={users} 
            slots={eventSlots} 
            categories={eventCategories}
            selectedEventId={selectedEventId}
            onUpdateSlots={handleUpdateSlotsBulk}
            isAssignmentLocked={selectedEvent?.status === 'closed' || selectedEvent?.status === 'archived'}
          />
        );
      case 'payments':
        return (
          <PaymentsPage 
            payments={payments}
            users={users}
            slots={eventSlots}
            selectedEvent={selectedEvent}
            onUpdateUser={handleUpdateUser}
            onUpdatePayment={handleUpdatePayment}
          />
        );
      case 'exports': 
        return (
          <ExportsPage 
            slots={eventSlots}
            categories={eventCategories} 
          />
        );
      default: return null;
    }
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="wpt-admin-theme">
      <AdminLayout 
        activeView={activeView} 
        onNavigate={setActiveView}
        events={events}
        selectedEventId={selectedEventId}
        onEventChange={setSelectedEventId}
        onCreateEvent={() => setIsCreateEventModalOpen(true)}
      >
        {renderContent()}

        <CreateEventModal 
          isOpen={isCreateEventModalOpen}
          onClose={() => setIsCreateEventModalOpen(false)}
          onConfirm={handleCreateEvent}
          existingEvents={events}
        />
      </AdminLayout>
    </ThemeProvider>
  );
}