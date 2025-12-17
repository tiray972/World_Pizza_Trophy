import React, { useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { Slot, User } from "../types";
import { X } from "lucide-react";

interface AssignSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string) => Promise<void>;
  slot: Slot | null;
  users: User[];
}

export function AssignSlotModal({
  isOpen,
  onClose,
  onConfirm,
  slot,
  users,
}: AssignSlotModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset selection when modal opens or slot changes
  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(slot?.userId || "");
      setIsSubmitting(false);
    }
  }, [isOpen, slot]);

  if (!isOpen || !slot) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setIsSubmitting(true);
    try {
      await onConfirm(selectedUserId);
      onClose();
    } catch (error) {
      console.error("Failed to assign slot", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="fixed z-50 grid w-full max-w-lg scale-100 gap-4 border bg-card text-card-foreground p-6 shadow-lg duration-200 sm:rounded-lg md:w-full">
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold leading-none tracking-tight text-foreground">
              Assign User to Slot
            </h2>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Select a competitor to assign to {slot.category} at {slot.startTime}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="user" className="text-right text-sm font-medium text-foreground">
              Competitor
            </label>
            <div className="col-span-3">
              <select
                id="user"
                className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
              >
                <option value="" disabled className="bg-background text-foreground">Select a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id} className="bg-background text-foreground">
                    {user.fullName} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedUserId}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}