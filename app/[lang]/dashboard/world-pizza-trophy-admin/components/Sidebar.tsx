import React from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/Button";
import { NavItem, ViewType, WPTEvent } from "@/types/firestore";
import { 
  LayoutDashboard, 
  Calendar, 
  Package, 
  Ticket, 
  Users, 
  Download,
  Trophy,
  ChevronDown,
  Settings as SettingsIcon,
  Plus,
  List,
  CreditCard
} from "lucide-react";

interface SidebarProps {
  className?: string;
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  
  // New Event Props
  events: WPTEvent[];
  selectedEventId: string;
  onEventChange: (eventId: string) => void;
  onCreateEvent: () => void;
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Event Settings",
    href: "settings",
    icon: SettingsIcon,
  },
  {
    title: "Categories", // New Link
    href: "categories",
    icon: List,
  },
  {
    title: "Slots",
    href: "slots",
    icon: Calendar,
  },
  {
    title: "Products",
    href: "products",
    icon: Package,
  },
  {
    title: "Payments", // New Link
    href: "payments",
    icon: CreditCard,
  },
  {
    title: "Vouchers",
    href: "vouchers",
    icon: Ticket,
  },
  {
    title: "Users",
    href: "users",
    icon: Users,
  },
  {
    title: "Exports",
    href: "exports",
    icon: Download,
  },
];

export function Sidebar({ 
  className, 
  activeView, 
  onNavigate, 
  onCloseMobile,
  events,
  selectedEventId,
  onEventChange,
  onCreateEvent
}: SidebarProps) {

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'create_new') {
      onCreateEvent();
    } else {
      onEventChange(val);
    }
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className={cn("pb-12 h-full bg-card text-card-foreground border-r flex flex-col", className)}>
      <div className="space-y-4 py-4 flex-1">
        <div className="px-3 py-2">
          {/* Logo & Event Selector */}
          <div className="flex flex-col gap-3 px-2 mb-8">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
                <Trophy className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight">
                WPT Admin
              </h2>
            </div>
            
            <div className="relative">
              <select
                className="w-full appearance-none bg-muted/50 border border-input text-foreground text-sm rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary font-medium truncate"
                value={selectedEventId || ""}
                onChange={handleSelectChange}
              >
                {events.length === 0 && <option value="">No Events Created</option>}
                
                {events.map(evt => (
                  <option key={evt.id} value={evt.id}>
                    {evt.name} ({evt.eventYear})
                  </option>
                ))}
                
                <option disabled>──────────</option>
                <option value="create_new" className="text-primary font-bold">+ Create New Event</option>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none bg-transparent" />
            </div>
          </div>

          <div className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Button
                key={item.href}
                variant={activeView === item.href ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start", 
                  activeView === item.href ? "font-semibold" : "font-normal text-muted-foreground"
                )}
                onClick={() => {
                  onNavigate(item.href as ViewType);
                  if (onCloseMobile) onCloseMobile();
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.title}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer / Settings Section */}
      <div className="px-3 py-4 mt-auto border-t">
        <Button variant="ghost" className="w-full justify-start font-normal text-muted-foreground">
          <Users className="mr-2 h-4 w-4" />
          Team Access
        </Button>
        <div className="px-4 py-2 text-xs text-muted-foreground text-center">
          v1.5.0 • {selectedEvent ? selectedEvent.eventYear : "No Event"}
        </div>
      </div>
    </div>
  );
}