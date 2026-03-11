import React, { useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { Slot, User, Category, Participant, SlotStatus } from "@/types/firestore";
import { X, UserPlus, Gift, CreditCard, Zap } from "lucide-react";
import { formatTime, formatUser } from "../lib/utils";

interface AssignSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string, participant?: Participant, forcedStatus?: SlotStatus) => Promise<void>;
  slot: Slot | null;
  users: User[];
  categories: Category[];
  defaultMode?: 'assign' | 'offer';
}

export function AssignSlotModal({
  isOpen,
  onClose,
  onConfirm,
  slot,
  users,
  categories,
  defaultMode = 'assign',
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
  // 'auto' = computed from user payment status, 'offered' = force offered, 'paid' = force paid
  const [statusMode, setStatusMode] = useState<'auto' | 'offered' | 'paid'>(
    defaultMode === 'offer' ? 'offered' : 'auto'
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(slot?.buyerId || "");
      setIsSubmitting(false);
      setShowParticipantForm(false);
      setParticipantData({ firstName: "", lastName: "", email: "", phone: "" });
      setStatusMode(defaultMode === 'offer' ? 'offered' : 'auto');
    }
  }, [isOpen, slot, defaultMode]);

  if (!isOpen || !slot) return null;

  const categoryName = categories.find(c => c.id === slot.categoryId)?.name || slot.categoryId;
  const selectedUser = users.find(u => u.id === selectedUserId);
  const isOffer = statusMode === 'offered';

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

      const forcedStatus: SlotStatus | undefined = statusMode !== 'auto'
        ? (statusMode as SlotStatus)
        : undefined;

      await onConfirm(selectedUserId, participant, forcedStatus);
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
            <div className="flex items-center gap-2">
              {isOffer
                ? <Gift className="h-5 w-5 text-purple-500" />
                : <UserPlus className="h-5 w-5" />
              }
              <h2 className="text-lg font-semibold leading-none tracking-tight text-foreground">
                {isOffer ? "Offer Slot" : "Assign Competitor to Slot"}
              </h2>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {categoryName} at {formatTime(slot.startTime)} on {slot.date}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">

          {/* ──────────── STATUS MODE SELECTOR ──────────── */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Slot Action</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatusMode('auto')}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-all ${statusMode === 'auto'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-input bg-background text-muted-foreground hover:border-primary/50'
                  }`}
              >
                <Zap className="h-4 w-4" />
                Auto
                <span className="text-[10px] font-normal opacity-70">Based on payment</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusMode('offered')}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-all ${statusMode === 'offered'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 font-semibold'
                    : 'border-input bg-background text-muted-foreground hover:border-purple-300'
                  }`}
              >
                <Gift className="h-4 w-4" />
                Offer
                <span className="text-[10px] font-normal opacity-70">Gift / Free slot</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusMode('paid')}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-all ${statusMode === 'paid'
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 font-semibold'
                    : 'border-input bg-background text-muted-foreground hover:border-green-300'
                  }`}
              >
                <CreditCard className="h-4 w-4" />
                Mark Paid
                <span className="text-[10px] font-normal opacity-70">Force paid status</span>
              </button>
            </div>
            {statusMode === 'offered' && (
              <p className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 px-3 py-2 rounded border border-purple-200 dark:border-purple-800">
                🎁 This slot will be marked as <strong>Offered</strong> — the competitor gets the slot without requiring payment.
              </p>
            )}
            {statusMode === 'paid' && (
              <p className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-3 py-2 rounded border border-green-200 dark:border-green-800">
                ✅ This slot will be marked as <strong>Paid</strong> — use this if payment was collected outside the platform.
              </p>
            )}
          </div>

          {/* ──────────── BUYER SELECTION ──────────── */}
          <div className="space-y-2">
            <label htmlFor="user" className="text-sm font-medium text-foreground">
              {statusMode === 'offered' ? 'Offer To (User Account)' : 'Buyer / Registration Owner'}
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

          {/* ──────────── CURRENT PARTICIPANT INFO ──────────── */}
          {slot.participant && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Current Participant:</p>
              <p className="text-sm text-green-800 dark:text-green-200">
                {slot.participant.firstName} {slot.participant.lastName}
                {slot.participant.email && ` (${slot.participant.email})`}
              </p>
            </div>
          )}

          {/* ──────────── PARTICIPANT FORM TOGGLE ──────────── */}
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

          {/* ──────────── PARTICIPANT INFO FORM ──────────── */}
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
            <Button
              type="submit"
              disabled={isSubmitting || !selectedUserId}
              className={isOffer ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}
            >
              {isSubmitting
                ? "Saving..."
                : isOffer
                  ? "🎁 Offer Slot"
                  : "Assign Slot"
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
