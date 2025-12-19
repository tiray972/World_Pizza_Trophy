"use client";
import React, { useState } from "react";
import { Button } from "./ui/Button";
import { Slot, User, Category } from "@/types/firestore";
import { X } from "lucide-react";
import { cn, formatTime, formatUser } from "../lib/utils";

interface ManualSlotAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string, slotIds: string[]) => Promise<void>;
  user: User | null;
  slots: Slot[];
  categories?: Category[]; // Made optional to preserve types if parent hasn't updated yet, but logic uses it
}

export function ManualSlotAssignModal({
  isOpen,
  onClose,
  onConfirm,
  user,
  slots,
  categories = []
}: ManualSlotAssignModalProps) {
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableSlots = slots.filter(s => !s.userId || s.userId === user?.id);

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || categoryId;
  };

  const toggleSlot = (slotId: string) => {
    setSelectedSlotIds(prev => 
      prev.includes(slotId) 
        ? prev.filter(id => id !== slotId)
        : [...prev, slotId]
    );
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await onConfirm(user.id, selectedSlotIds);
      setSelectedSlotIds([]); // Reset selection
      onClose();
    } catch (error) {
      console.error("Failed to assign slots", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className="fixed z-50 grid w-full max-w-2xl scale-100 gap-4 border bg-card text-card-foreground p-0 shadow-lg duration-200 sm:rounded-lg md:w-full overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex flex-col space-y-1.5 p-6 pb-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              Assign Slots to {formatUser(user)}
            </h2>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Select slots to manually assign to this competitor.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-2">
           <div className="space-y-4">
            {availableSlots.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No available slots found.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {availableSlots.map(slot => {
                  const isSelected = selectedSlotIds.includes(slot.id);
                  return (
                    <div
                      key={slot.id}
                      className={cn(
                        "flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
                        isSelected ? "bg-accent border-primary/50" : "bg-card hover:bg-muted/50"
                      )}
                      onClick={() => toggleSlot(slot.id)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} 
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary bg-background"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {slot.date} | {formatTime(slot.startTime)}
                          </span>
                          <span className="text-xs text-muted-foreground">({formatTime(slot.endTime)})</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{getCategoryName(slot.categoryId)}</p>
                      </div>
                      <div className="text-xs font-medium px-2 py-1 rounded bg-secondary text-secondary-foreground">
                        {slot.status}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
           </div>
        </div>
        
        <div className="border-t bg-muted/40 p-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedSlotIds.length === 0}>
            {isSubmitting ? "Assigning..." : `Assign ${selectedSlotIds.length} Slot${selectedSlotIds.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
