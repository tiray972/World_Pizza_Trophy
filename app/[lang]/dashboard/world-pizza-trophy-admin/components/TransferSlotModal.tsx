import React, { useMemo, useState } from "react";
import { Button } from "./ui/Button";
import { Slot, Category } from "@/types/firestore";
import { X, ArrowRight, Loader2 } from "lucide-react";
import { formatTime } from "../lib/utils";
import { getSlotParticipants } from "@/lib/booking/rules";

interface TransferSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetSlotId: string) => Promise<void>;
  slot: Slot | null;
  slots: Slot[];
  categories: Category[];
}

export function TransferSlotModal({
  isOpen,
  onClose,
  onConfirm,
  slot,
  slots,
  categories,
}: TransferSlotModalProps) {
  const [targetCategoryId, setTargetCategoryId] = useState<string>("all");
  const [targetDate, setTargetDate] = useState<string>("all");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoryName = (categoryId: string) =>
    categories.find(category => category.id === categoryId)?.name || categoryId;

  // Seuls les créneaux réellement libres peuvent accueillir la réservation
  const availableSlots = useMemo(
    () =>
      slots
        .filter(candidate => candidate.status === "available" && candidate.id !== slot?.id)
        .sort((a, b) =>
          a.date === b.date
            ? a.startTime.getTime() - b.startTime.getTime()
            : a.date.localeCompare(b.date)
        ),
    [slots, slot]
  );

  const dates = useMemo(
    () => Array.from(new Set(availableSlots.map(candidate => candidate.date))).sort(),
    [availableSlots]
  );

  const filteredSlots = availableSlots.filter(candidate => {
    if (targetCategoryId !== "all" && candidate.categoryId !== targetCategoryId) return false;
    if (targetDate !== "all" && candidate.date !== targetDate) return false;
    return true;
  });

  if (!isOpen || !slot) return null;

  const participants = getSlotParticipants(slot);

  const handleConfirm = async () => {
    if (!selectedTargetId) return;
    setIsSubmitting(true);
    try {
      await onConfirm(selectedTargetId);
      setSelectedTargetId("");
      onClose();
    } catch (error) {
      console.error("❌ Transfert impossible:", error);
      alert(
        "Le transfert n'a pas pu être effectué. Rien n'a été modifié.\n\n" +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed z-50 grid w-full max-w-2xl gap-4 border bg-card text-card-foreground p-6 shadow-lg sm:rounded-lg overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Transférer la réservation</h2>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Créneau d'origine */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">Créneau actuel</p>
          <p className="font-semibold">
            {categoryName(slot.categoryId)} — {slot.date} à {formatTime(slot.startTime)}
          </p>
          <p className="text-sm text-muted-foreground">
            {participants.length > 0
              ? participants.map(participant => `${participant.firstName} ${participant.lastName}`).join(" & ")
              : "Aucun participant renseigné"}
            {" · "}
            {slot.status === "paid" ? "Payé" : slot.status === "offered" ? "Offert" : slot.status}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          L&apos;acheteur, le participant, le paiement et la date de paiement suivent vers le nouveau
          créneau. L&apos;ancien redevient disponible à la vente. Le montant encaissé ne change pas.
        </p>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          <select
            value={targetCategoryId}
            onChange={(e) => {
              setTargetCategoryId(e.target.value);
              setSelectedTargetId("");
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Toutes les catégories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <select
            value={targetDate}
            onChange={(e) => {
              setTargetDate(e.target.value);
              setSelectedTargetId("");
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Toutes les dates</option>
            {dates.map(date => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
        </div>

        {/* Créneaux disponibles */}
        <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
          {filteredSlots.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Aucun créneau disponible pour ce filtre.
            </p>
          ) : (
            filteredSlots.map(candidate => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setSelectedTargetId(candidate.id)}
                className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                  selectedTargetId === candidate.id
                    ? "bg-primary/10 border-l-4 border-primary font-semibold"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className="font-medium">{categoryName(candidate.categoryId)}</span>
                <span className="text-muted-foreground">
                  {" — "}
                  {candidate.date} à {formatTime(candidate.startTime)} ({formatTime(candidate.endTime)})
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!selectedTargetId || isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Transférer
          </Button>
        </div>
      </div>
    </div>
  );
}
