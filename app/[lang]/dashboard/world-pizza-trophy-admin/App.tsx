"use client";
import React, { useState } from 'react';
import { AdminLayout } from './components/AdminLayout';
import { ViewType, Slot, User } from './types';
import { Button } from './components/ui/Button';
import { SlotsPage } from './components/SlotsPage';
import { ProductsPage } from './components/ProductsPage';
import { VouchersPage } from './components/VouchersPage';
import { UsersPage } from './components/UsersPage';
import { ExportsPage } from './components/ExportsPage';
import { ThemeProvider } from './components/ThemeProvider';

// --- SHARED MOCK DATA SOURCE ---
const INITIAL_USERS: User[] = [
  { id: "u1", fullName: "Mario Rossi", email: "mario@pizzapro.com", paid: true },
  { id: "u2", fullName: "Luigi Verdi", email: "luigi@napoli.it", paid: true },
  { id: "u3", fullName: "John Doe", email: "john@usapizza.com", paid: false },
  { id: "u4", fullName: "Sophie Blanc", email: "sophie@france.fr", paid: true },
  { id: "u5", fullName: "Hans Müller", email: "hans@germany.de", paid: false },
  { id: "u6", fullName: "Giulia Bianchi", email: "giulia@rome.it", paid: true },
];

const INITIAL_SLOTS: Slot[] = [
  // Day 1 (Mock: 2025-03-23)
  { id: "s1", category: "Classic", date: "2025-03-23", startTime: "10:00", endTime: "10:30", status: "paid", userId: "u1", userFullName: "Mario Rossi" },
  { id: "s2", category: "Classic", date: "2025-03-23", startTime: "10:30", endTime: "11:00", status: "available" },
  { id: "s3", category: "Napo", date: "2025-03-23", startTime: "11:00", endTime: "11:30", status: "offered", userId: "u3", userFullName: "John Doe" },
  { id: "s4", category: "Napo", date: "2025-03-23", startTime: "11:30", endTime: "12:00", status: "available" },
  { id: "s5", category: "Freestyle", date: "2025-03-23", startTime: "14:00", endTime: "14:30", status: "available" },
  // Day 2 (Mock: 2025-03-24)
  { id: "s6", category: "Classic", date: "2025-03-24", startTime: "10:00", endTime: "10:30", status: "paid", userId: "u2", userFullName: "Luigi Verdi" },
  { id: "s7", category: "Classic", date: "2025-03-24", startTime: "10:30", endTime: "11:00", status: "available" },
  { id: "s8", category: "Pizza dessert", date: "2025-03-24", startTime: "15:00", endTime: "15:30", status: "available" },
];

// Simple placeholder components for each view
const DashboardPlaceholder = () => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    {[
      { title: "Total Revenue", value: "$45,231.89", sub: "+20.1% from last month" },
      { title: "Active Slots", value: "+2350", sub: "+180.1% from last month" },
      { title: "Products Sold", value: "+12,234", sub: "+19% from last month" },
      { title: "Active Users", value: "+573", sub: "+201 since last hour" },
    ].map((item, i) => (
      <div key={i} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
        <div className="text-sm font-medium tracking-tight text-muted-foreground">{item.title}</div>
        <div className="text-2xl font-bold">{item.value}</div>
        <div className="text-xs text-muted-foreground mt-1">{item.sub}</div>
      </div>
    ))}
  </div>
);

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('products');
  
  // Lifted State
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [slots, setSlots] = useState<Slot[]>(INITIAL_SLOTS);

  // Update handlers
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

  const handleCreateSlots = async (slotsData: Omit<Slot, "id" | "status" | "userId" | "userFullName">[]) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newSlots: Slot[] = slotsData.map((data, index) => ({
      ...data,
      id: `s${Date.now()}-${index}`,
      status: 'available'
    }));
    
    setSlots(prev => [...prev, ...newSlots]);
  };

  const handleDeleteSlot = async (slotId: string) => {
    // Simulate API
    await new Promise(resolve => setTimeout(resolve, 300));
    setSlots(prev => prev.filter(s => s.id !== slotId));
  };

  const handleDeleteDate = async (date: string) => {
    // Simulate API
    await new Promise(resolve => setTimeout(resolve, 600));
    setSlots(prev => prev.filter(s => s.date !== date));
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard': return <DashboardPlaceholder />;
      case 'slots': 
        return (
          <SlotsPage 
            slots={slots} 
            users={users} 
            onUpdateSlot={handleUpdateSlot} 
            onCreateSlot={handleCreateSlots}
            onDeleteSlot={handleDeleteSlot}
            onDeleteDate={handleDeleteDate}
          />
        );
      case 'products': return <ProductsPage />;
      case 'vouchers': return <VouchersPage />;
      case 'users': 
        return (
          <UsersPage 
            users={users} 
            slots={slots} 
            onUpdateSlots={handleUpdateSlotsBulk}
          />
        );
      case 'exports': 
        return (
          <ExportsPage 
            slots={slots} 
          />
        );
      default: return <DashboardPlaceholder />;
    }
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="wpt-admin-theme">
      <AdminLayout 
        activeView={activeView} 
        onNavigate={setActiveView}
      >
        {/* 
           Header Section is now handled inside specific pages like SlotsPage, 
           ProductsPage or VouchersPage to allow custom page headers.
        */}
        {activeView !== 'slots' && activeView !== 'products' && activeView !== 'vouchers' && activeView !== 'users' && activeView !== 'exports' && (
          <div className="flex items-center justify-between space-y-2 mb-6">
            <h2 className="text-3xl font-bold tracking-tight capitalize">{activeView}</h2>
            <div className="flex items-center space-x-2">
              <Button>Download Report</Button>
            </div>
          </div>
        )}
        
        {/* Main View Content */}
        {renderContent()}
      </AdminLayout>
    </ThemeProvider>
  );
}