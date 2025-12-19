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
import { PaymentsPage } from './components/PaymentsPage'; // NEW
import { CreateEventModal } from './components/CreateEventModal';
import { ThemeProvider } from './components/ThemeProvider';
import { 
  INITIAL_CATEGORIES, 
  INITIAL_SLOTS, 
  INITIAL_USERS, 
  MOCK_EVENTS, 
  MOCK_PRODUCTS, 
  MOCK_VOUCHERS, 
  MOCK_PAYMENTS, // NEW
  WPT_DEFAULT_TEMPLATE_CATEGORIES, 
  WPT_DEFAULT_TEMPLATE_PRODUCTS 
} from './lib/mockData';
import { formatCurrency } from './lib/utils';

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
  // Calculate dynamic stats
  const registeredUsers = users.filter(u => u.registrations[eventId]);
  const paidUsers = registeredUsers.filter(u => u.registrations[eventId].paid);
  
  // Total Revenue calculation (Mock approximation based on products sold)
  // In a real app, we'd query a Payments collection filtered by eventId.
  // Here we'll simulate it: Paid users * Average Product Price
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
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-12 text-center text-muted-foreground">
         Detailed Analytics Charts would appear here.
      </div>
    </div>
  );
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('slots');
  
  // --- EVENTS STATE ---
  const [events, setEvents] = useState<WPTEvent[]>(MOCK_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState<string>(MOCK_EVENTS[0]?.id || "");
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);

  // Derived state for current event
  const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId), [events, selectedEventId]);

  // --- DATA STATE ---
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [slots, setSlots] = useState<Slot[]>(INITIAL_SLOTS);
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [vouchers, setVouchers] = useState<Voucher[]>(MOCK_VOUCHERS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [payments, setPayments] = useState<Payment[]>(MOCK_PAYMENTS); // NEW State

  // --- FILTERED DATA PER EVENT ---
  // Filter slots, products, and vouchers to only show those belonging to the selected event
  const eventSlots = useMemo(() => slots.filter(s => s.eventId === selectedEventId), [slots, selectedEventId]);
  const eventProducts = useMemo(() => products.filter(p => p.eventId === selectedEventId), [products, selectedEventId]);
  const eventVouchers = useMemo(() => vouchers.filter(v => v.eventId === selectedEventId), [vouchers, selectedEventId]);
  const eventCategories = useMemo(() => categories.filter(c => c.eventId === selectedEventId), [categories, selectedEventId]);

  // --- HANDLERS ---

  const handleUpdateEvent = (updatedEvent: WPTEvent) => {
    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
  };

  const handleCreateEvent = async (eventData: Omit<WPTEvent, "id" | "status">, copyFromEventId: string | null) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const newEventId = `evt_${Date.now()}`;
    const newEvent: WPTEvent = {
      ...eventData,
      id: newEventId,
      status: 'draft', // New events start as draft
    };

    let newCategories: Category[] = [];
    let newProducts: Product[] = [];

    // --- TEMPLATE / DUPLICATION LOGIC ---
    if (copyFromEventId === 'default_template') {
        // USE WPT STANDARD TEMPLATE (Hardcoded 2025 structure)
        newCategories = WPT_DEFAULT_TEMPLATE_CATEGORIES.map((tpl, idx) => ({
            ...tpl,
            id: `cat_${Date.now()}_${idx}`,
            eventId: newEventId,
            activeDates: [], // Explicitly empty, needs manual scheduling
        }));

        newProducts = WPT_DEFAULT_TEMPLATE_PRODUCTS.map((tpl, idx) => ({
            ...tpl,
            id: `pack_${Date.now()}_${idx}`,
            eventId: newEventId,
        }));

    } else if (copyFromEventId) {
        // DUPLICATE FROM EXISTING EVENT
        const sourceCategories = categories.filter(c => c.eventId === copyFromEventId);
        newCategories = sourceCategories.map(c => ({
            ...c,
            id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            eventId: newEventId,
            activeDates: [], // Reset active dates as new event dates are different
        }));

        const sourceProducts = products.filter(p => p.eventId === copyFromEventId);
        newProducts = sourceProducts.map(p => ({
            ...p,
            id: `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            eventId: newEventId,
        }));
    } 
    // If copyFromEventId is empty/null, we create a BLANK event (no cats, no products)

    setCategories(prev => [...prev, ...newCategories]);
    setProducts(prev => [...prev, ...newProducts]);
    setEvents(prev => [newEvent, ...prev]);
    setSelectedEventId(newEvent.id);
    setActiveView('categories'); // Send user to review categories first
  };

  const handleUpdateSlot = (updatedSlot: Slot) => {
    setSlots(prev => prev.map(s => s.id === updatedSlot.id ? updatedSlot : s));
  };

  const handleUpdateSlotsBulk = (updatedSlots: Slot[]) => {
    setSlots(prev => {
      const newSlots = [...prev];
      updatedSlots.forEach(updated => {
        const index = newSlots.findIndex(s => s.id === updated.id);
        if (index !== -1) newSlots[index] = updated;
      });
      return newSlots;
    });
  };

  const handleCreateSlots = async (slotsData: Omit<Slot, "id" | "status" | "userId" | "stripeSessionId" | "eventId">[]) => {
    if (!selectedEventId) {
      alert("No event selected. Cannot create slots.");
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newSlots: Slot[] = slotsData.map((data, index) => ({
      ...data,
      id: `s${Date.now()}-${index}`,
      eventId: selectedEventId,
      status: 'available',
      stripeSessionId: null
    }));
    
    setSlots(prev => [...prev, ...newSlots]);

    // Update categories active dates logic (simplified)
    const categoryDatesMap = new Map<string, Set<string>>();
    slotsData.forEach(slot => {
      if (!categoryDatesMap.has(slot.categoryId)) {
        categoryDatesMap.set(slot.categoryId, new Set());
      }
      categoryDatesMap.get(slot.categoryId)?.add(slot.date);
    });

    setCategories(prevCategories => {
      return prevCategories.map(cat => {
        const newDatesForCat = categoryDatesMap.get(cat.id);
        if (newDatesForCat) {
          const currentDates = new Set(cat.activeDates);
          let hasChanged = false;
          newDatesForCat.forEach(date => {
            if (!currentDates.has(date)) {
              currentDates.add(date);
              hasChanged = true;
            }
          });
          if (hasChanged) {
            return { ...cat, activeDates: Array.from(currentDates).sort() };
          }
        }
        return cat;
      });
    });
  };

  const handleDeleteSlot = async (slotId: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    setSlots(prev => prev.filter(s => s.id !== slotId));
  };

  const handleDeleteDate = async (date: string) => {
    await new Promise(resolve => setTimeout(resolve, 600));
    setSlots(prev => prev.filter(s => !(s.date === date && s.eventId === selectedEventId)));
  };

  // --- PRODUCT & VOUCHER HANDLERS ---
  const handleCreateProduct = async (productData: Omit<Product, "id">) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newProduct: Product = { ...productData, id: `p${Date.now()}` };
    setProducts(prev => [newProduct, ...prev]);
  };

  const handleDeleteProduct = async (productId: string) => {
    // Logic moved to component (modal), this just executes deletion
    await new Promise(resolve => setTimeout(resolve, 300));
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleCreateVoucher = async (voucherData: Omit<Voucher, "id">) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newVoucher: Voucher = { ...voucherData, id: `v${Date.now()}` };
    setVouchers(prev => [newVoucher, ...prev]);
  };

  const handleDeleteVoucher = async (voucherId: string) => {
    // Logic moved to component (modal), this just executes deletion
    await new Promise(resolve => setTimeout(resolve, 300));
    setVouchers(prev => prev.filter(v => v.id !== voucherId));
  };

  // --- CATEGORY HANDLERS ---
  const handleUpdateCategory = (updatedCat: Category) => {
    setCategories(prev => prev.map(c => c.id === updatedCat.id ? updatedCat : c));
  };

  const handleCreateCategory = (catData: Omit<Category, "id">) => {
    const newCat: Category = { ...catData, id: `cat_${Date.now()}` };
    setCategories(prev => [...prev, newCat]);
  };

  const handleDeleteCategory = (catId: string) => {
      // Logic moved to component (modal), this just executes deletion
      setCategories(prev => prev.filter(c => c.id !== catId));
  };
  
  // --- USER & PAYMENT HANDLERS ---
  const handleUpdateUser = (userId: string, data: Partial<User>) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u));
  };

  const handleUpdatePayment = (paymentId: string, data: Partial<Payment>) => {
      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, ...data } : p));
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
                slots={eventSlots} // Added to support deletion validation
                selectedEventId={selectedEventId}
                onUpdateCategory={handleUpdateCategory}
                onCreateCategory={handleCreateCategory}
                onDeleteCategory={handleDeleteCategory}
            />
        );
      case 'slots': 
        return (
          <SlotsPage 
            slots={slots} // SlotsPage filters internally, but we could pass eventSlots
            users={users} 
            categories={eventCategories} // Only pass categories for the current event
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
            categories={categories}
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
            categories={categories} 
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
        {/* Header content depends on view */}
        {activeView !== 'slots' && activeView !== 'products' && activeView !== 'vouchers' && activeView !== 'users' && activeView !== 'payments' && activeView !== 'exports' && activeView !== 'settings' && activeView !== 'categories' && (
          <div className="flex items-center justify-between space-y-2 mb-6">
            <h2 className="text-3xl font-bold tracking-tight capitalize">{activeView}</h2>
            <div className="flex items-center space-x-2">
              <Button>Download Report ({selectedEvent?.eventYear || 'N/A'})</Button>
            </div>
          </div>
        )}
        
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