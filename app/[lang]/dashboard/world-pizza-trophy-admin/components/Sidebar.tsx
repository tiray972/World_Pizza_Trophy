import React from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/Button";
import { NavItem, ViewType } from "../types";
import { 
  LayoutDashboard, 
  Calendar, 
  Package, 
  Ticket, 
  Users, 
  Download,
  Trophy
} from "lucide-react";

interface SidebarProps {
  className?: string;
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "dashboard",
    icon: LayoutDashboard,
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

export function Sidebar({ className, activeView, onNavigate, isOpenMobile, onCloseMobile }: SidebarProps) {
  return (
    <div className={cn("pb-12 h-full bg-card text-card-foreground border-r", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="flex items-center px-2 mb-8 gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
              <Trophy className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              WPT Admin
            </h2>
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
        
        {/* Example Lower Section */}
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground">
            Settings
          </h2>
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start font-normal text-muted-foreground">
              <Users className="mr-2 h-4 w-4" />
              Team Members
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}