"use client";
import React, { useState } from "react";
import { Button } from "./ui/Button";
import { Slot, User, Category, Participant } from "@/types/firestore";
import { X, UserPlus } from "lucide-react";
import { cn, formatTime, formatUser } from "../lib/utils";

interface ManualSlotAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string, slotIds: string[], participants?: Record<string, Participant>) => Promise<void>;
  user: User | null;
  slots: Slot[];
  categories?: Category[];
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
  const [showParticipantForm, setShowParticipantForm] = useState(false);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});

  const availableSlots = slots.filter(s => !s.buyerId || s.buyerId === user?.id);

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

  const handleParticipantChange = (slotId: string, field: string, value: string) => {
    setParticipants(prev => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await onConfirm(user.id, selectedSlotIds, showParticipantForm ? participants : undefined);
      setSelectedSlotIds([]);
      setParticipants({});
      setShowParticipantForm(false);
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
            {/* Participant Info Toggle */}
            <Button
              type="button"
              variant={showParticipantForm ? "default" : "outline"}
              size="sm"
              className="w-full"
              onClick={() => setShowParticipantForm(!showParticipantForm)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {showParticipantForm ? "Hide Participant Info" : "Add Participant Info for Each Slot"}
            </Button>

            {availableSlots.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No available slots found.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {availableSlots.map(slot => {
                  const isSelected = selectedSlotIds.includes(slot.id);
                  const slotParticipant = participants[slot.id];
                  
                  return (
                    <div
                      key={slot.id}
                      className={cn(
                        "rounded-lg border p-4 transition-colors space-y-3",
                        isSelected ? "border-green-500 bg-green-50/30 dark:bg-green-950/10" : "bg-card hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSlot(slot.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary bg-background mt-1"
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

                      {/* Participant Form for Selected Slots */}
                      {isSelected && showParticipantForm && (
                        <div className="ml-7 p-3 bg-muted/30 rounded-lg border border-dashed space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">👤 Participant Details</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="First Name"
                              className="h-8 rounded border border-input bg-background px-2 py-1 text-xs"
                              value={slotParticipant?.firstName || ""}
                              onChange={(e) => handleParticipantChange(slot.id, "firstName", e.target.value)}
                            />
                            <input
                              type="text"
                              placeholder="Last Name"
                              className="h-8 rounded border border-input bg-background px-2 py-1 text-xs"
                              value={slotParticipant?.lastName || ""}
                              onChange={(e) => handleParticipantChange(slot.id, "lastName", e.target.value)}
                            />
                            <input
                              type="email"
                              placeholder="Email (optional)"
                              className="h-8 rounded border border-input bg-background px-2 py-1 text-xs col-span-2"
                              value={slotParticipant?.email || ""}
                              onChange={(e) => handleParticipantChange(slot.id, "email", e.target.value)}
                            />
                            <input
                              type="tel"
                              placeholder="Phone (optional)"
                              className="h-8 rounded border border-input bg-background px-2 py-1 text-xs col-span-2"
                              value={slotParticipant?.phone || ""}
                              onChange={(e) => handleParticipantChange(slot.id, "phone", e.target.value)}
                            />
                          </div>
                        </div>
                      )}
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
