import React from "react";
import { Menu, Bell, User } from "lucide-react";
import { Button } from "./ui/Button";
import { ThemeToggle } from "./ui/ThemeToggle";

interface HeaderProps {
  onMobileMenuToggle: () => void;
  title: string;
}

export function Header({ onMobileMenuToggle, title }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 md:hidden text-foreground"
          onClick={onMobileMenuToggle}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
        
        <div className="flex flex-1 items-center justify-between">
          <h1 className="text-lg font-semibold md:text-xl text-foreground">{title}</h1>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              <span className="sr-only">Notifications</span>
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full text-foreground">
              <User className="h-5 w-5" />
              <span className="sr-only">User Profile</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}