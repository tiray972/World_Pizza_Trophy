import React from "react";
import { Button } from "./ui/Button";
import { Category } from "@/types/firestore";
import { X, Clock, Users, FileText, Check, Trophy, Calendar } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import { Badge } from "./ui/Badge";

interface CategoryPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
}

export function CategoryPreviewModal({ isOpen, onClose, category }: CategoryPreviewModalProps) {
  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="fixed z-50 w-full max-w-md scale-100 bg-white dark:bg-zinc-950 p-0 shadow-2xl duration-200 sm:rounded-xl overflow-hidden border border-border">
        {/* Mock Public Header */}
        <div className="bg-primary text-primary-foreground p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span className="font-semibold text-sm">WPT Registration</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground hover:bg-primary/80" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
        </div>

        {/* Card Content - Simulating User View */}
        <div className="p-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">{category.name}</h2>
                    <Badge variant="secondary" className="mt-2 text-xs font-normal">
                        Category Preview
                    </Badge>
                </div>
                <div className="text-xl font-bold text-primary">
                    {formatCurrency(category.unitPrice)}
                </div>
            </div>
            
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                {category.description}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3">
                    <div className="bg-background p-2 rounded-full shadow-sm">
                        <Clock className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Duration</div>
                        <div className="font-semibold text-sm">{category.durationMinutes} min</div>
                    </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3">
                    <div className="bg-background p-2 rounded-full shadow-sm">
                        <Users className="h-4 w-4 text-purple-500" />
                    </div>
                    <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Limited</div>
                        <div className="font-semibold text-sm">{category.maxSlots} spots</div>
                    </div>
                </div>
            </div>

            {category.rules && (
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900 rounded-lg p-4 mb-6">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                        <FileText className="h-4 w-4" />
                        Rules & Regulations
                    </h4>
                    <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                        {category.rules}
                    </p>
                </div>
            )}

            <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Official Certification included</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Access to backstage prep area</span>
                </div>
            </div>

            <Button className="w-full mt-8 h-12 text-base font-semibold shadow-lg shadow-primary/20">
                Select This Category
            </Button>
            
            <p className="text-center text-xs text-muted-foreground mt-4">
                This is a preview of the public booking card.
            </p>
        </div>
      </div>
    </div>
  );
}