"use client";
import React, { useState } from "react";
import { Sidebar, NAV_ITEMS } from "./Sidebar";
import { Header } from "./Header";
import { ViewType, WPTEvent } from "@/types/firestore";
import { cn } from "../lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  
  // Event props
  events: WPTEvent[];
  selectedEventId: string;
  onEventChange: (id: string) => void;
  onCreateEvent: () => void;
}

export function AdminLayout({ 
  children, 
  activeView, 
  onNavigate,
  events,
  selectedEventId,
  onEventChange,
  onCreateEvent
}: AdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeTitle = NAV_ITEMS.find(i => i.href === activeView)?.title || "Dashboard";

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Sidebar: Hidden on mobile, fixed on desktop */}
      <aside 
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-64 -translate-x-full transition-transform duration-200 md:translate-x-0 md:static md:block border-r bg-card",
          isMobileMenuOpen ? "translate-x-0 shadow-xl" : ""
        )}
      >
        <Sidebar 
          activeView={activeView} 
          onNavigate={onNavigate} 
          events={events}
          selectedEventId={selectedEventId}
          onEventChange={onEventChange}
          onCreateEvent={onCreateEvent}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Header 
          title={activeTitle} 
          onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
        />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
