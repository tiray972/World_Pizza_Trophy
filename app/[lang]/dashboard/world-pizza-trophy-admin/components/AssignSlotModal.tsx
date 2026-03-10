import React, { useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { Slot, User, Category, Participant } from "@/types/firestore";
import { X, UserPlus } from "lucide-react";
import { formatTime, formatUser } from "../lib/utils";

interface AssignSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string, participant?: Participant) => Promise<void>;
  slot: Slot | null;
  users: User[];
  categories: Category[];
}

export function AssignSlotModal({
  isOpen,
  onClose,
  onConfirm,
  slot,
  users,
  categories,
}: AssignSlotModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showParticipantForm, setShowParticipantForm] = useState(false);
  const [participantData, setParticipantData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: ""
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(slot?.buyerId || "");
      setIsSubmitting(false);
      setShowParticipantForm(false);
      setParticipantData({ firstName: "", lastName: "", email: "", phone: "" });
    }
  }, [isOpen, slot]);

  if (!isOpen || !slot) return null;

  const categoryName = categories.find(c => c.id === slot.categoryId)?.name || slot.categoryId;
  const selectedUser = users.find(u => u.id === selectedUserId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setIsSubmitting(true);
    try {
      const participant: Participant | undefined = showParticipantForm && (participantData.firstName || participantData.lastName) 
        ? {
            firstName: participantData.firstName,
            lastName: participantData.lastName,
            email: participantData.email || undefined,
            phone: participantData.phone || undefined
          }
        : undefined;

      await onConfirm(selectedUserId, participant);
      onClose();
    } catch (error) {
      console.error("Failed to assign slot", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleParticipantChange = (field: string, value: string) => {
    setParticipantData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="fixed z-50 grid w-full max-w-lg scale-100 gap-4 border bg-card text-card-foreground p-6 shadow-lg duration-200 sm:rounded-lg md:w-full overflow-y-auto max-h-[90vh]">
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold leading-none tracking-tight text-foreground">
              Assign Competitor to Slot
            </h2>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {categoryName} at {formatTime(slot.startTime)} on {slot.date}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {/* Buyer Selection */}
          <div className="space-y-2">
            <label htmlFor="user" className="text-sm font-medium text-foreground">
              Buyer / Registration Owner
            </label>
            <select
              id="user"
              className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              required
            >
              <option value="" disabled className="bg-background text-foreground">Select a user...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id} className="bg-background text-foreground">
                  {formatUser(user)} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* Current Participant Info */}
          {slot.participant && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Current Participant:</p>
              <p className="text-sm text-green-800 dark:text-green-200">
                {slot.participant.firstName} {slot.participant.lastName}
                {slot.participant.email && ` (${slot.participant.email})`}
              </p>
            </div>
          )}

          {/* Participant Form Toggle */}
          <div className="pt-2 border-t">
            <Button
              type="button"
              variant={showParticipantForm ? "default" : "outline"}
              size="sm"
              className="w-full"
              onClick={() => setShowParticipantForm(!showParticipantForm)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {showParticipantForm ? "Hide Participant Info" : "Add/Edit Participant Info"}
            </Button>
          </div>

          {/* Participant Information Form */}
          {showParticipantForm && (
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-dashed">
              <p className="text-xs font-semibold text-muted-foreground">
                👤 Participant Details (can be different from buyer)
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <label htmlFor="firstName" className="text-xs font-medium">First Name *</label>
                  <input
                    id="firstName"
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={participantData.firstName}
                    onChange={(e) => handleParticipantChange("firstName", e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="lastName" className="text-xs font-medium">Last Name *</label>
                  <input
                    id="lastName"
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={participantData.lastName}
                    onChange={(e) => handleParticipantChange("lastName", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label htmlFor="email" className="text-xs font-medium">Email</label>
                <input
                  id="email"
                  type="email"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={participantData.email}
                  onChange={(e) => handleParticipantChange("email", e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="phone" className="text-xs font-medium">Phone</label>
                <input
                  id="phone"
                  type="tel"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={participantData.phone}
                  onChange={(e) => handleParticipantChange("phone", e.target.value)}
                />
              </div>
            </div>
          )}
          
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedUserId}>
              {isSubmitting ? "Saving..." : "Assign Slot"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
