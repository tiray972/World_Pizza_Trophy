"use client";
import React, { useState } from "react";
import { Button } from "./ui/Button";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: React.ReactNode;
  /** Récapitulatif de l'action : ce sur quoi on agit, en clair. */
  details?: { label: string; value: React.ReactNode }[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "neutral";
  /** Texte à saisir à l'identique pour débloquer la confirmation. */
  confirmationPhrase?: string;
}

const TONES = {
  danger: "text-destructive",
  warning: "text-amber-600 dark:text-amber-400",
  neutral: "text-foreground",
};

/**
 * Confirmation explicite avant une action qui change l'état d'un créneau.
 * Plusieurs personnes utilisent le dashboard : mieux vaut un écran de trop
 * qu'une réservation déplacée ou effacée par mégarde.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  details = [],
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "warning",
  confirmationPhrase,
}: ConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [typed, setTyped] = useState("");

  if (!isOpen) return null;

  const canConfirm = !confirmationPhrase || typed.trim().toUpperCase() === confirmationPhrase.toUpperCase();

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
      setTyped("");
      onClose();
    } catch (error) {
      console.error("❌ Action impossible:", error);
      alert(
        "L'action n'a pas pu être effectuée. Rien n'a été modifié.\n\n" +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed z-[60] grid w-full max-w-md gap-4 border bg-card text-card-foreground p-6 shadow-lg sm:rounded-lg">
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-semibold flex items-center gap-2 ${TONES[tone]}`}>
            <AlertTriangle className="h-5 w-5" />
            {title}
          </h2>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">{description}</div>

        {details.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-1">
            {details.map((detail, index) => (
              <div key={index} className="flex justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{detail.label}</span>
                <span className="font-medium text-right">{detail.value}</span>
              </div>
            ))}
          </div>
        )}

        {confirmationPhrase && (
          <div className="grid gap-2">
            <label htmlFor="confirmPhrase" className="text-xs font-medium">
              Tapez <span className="font-bold">{confirmationPhrase}</span> pour confirmer
            </label>
            <input
              id="confirmPhrase"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoComplete="off"
            />
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isSubmitting}
            className={tone === "danger" ? "bg-destructive hover:bg-destructive/90 text-white" : ""}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
