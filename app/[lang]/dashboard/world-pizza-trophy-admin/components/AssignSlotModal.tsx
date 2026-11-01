"use client";

// Attribution manuelle d'un créneau libre. Pizza Due : les deux équipiers sont
// saisis ici, dès l'attribution. « Payé » n'existe qu'en rattachant le créneau
// à un paiement réel de l'acheteur ; sinon le créneau est offert.

import React, { useMemo, useState } from "react";
import { X, Gift, CreditCard } from "lucide-react";
import { Button } from "./ui/Button";
import { MemberFields, membersComplete } from "./MemberFields";
import { assignSlots, emptyMember, membersPayload, useEventIdentities, type MemberDraft } from "../lib/assignSlots";
import { newRequestId } from "../lib/adminFetch";
import { formatTime, formatUser } from "../lib/utils";
import { getParticipantsPerSlot } from "@/lib/booking/rules";
import type { Category, Payment, Slot, User } from "@/types/firestore";

interface AssignSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
  slot: Slot | null;
  users: User[];
  categories: Category[];
  payments: Payment[];
  eventId: string;
  defaultMode?: "assign" | "offer";
}

export function AssignSlotModal(props: AssignSlotModalProps) {
  if (!props.isOpen || !props.slot) return null;
  // Remonté à chaque ouverture : formulaire vierge, nouvelle requête idempotente.
  return <AssignSlotForm key={props.slot.id} {...props} slot={props.slot} />;
}

function AssignSlotForm({ onClose, onDone, slot, users, categories, payments, eventId, defaultMode = "assign" }: AssignSlotModalProps & { slot: Slot }) {
  const category = categories.find(item => item.id === slot.categoryId);
  const required = getParticipantsPerSlot(category);
  const [buyerId, setBuyerId] = useState(slot.buyerId || "");
  const [status, setStatus] = useState<"offered" | "paid">("offered");
  const [paymentId, setPaymentId] = useState("");
  const [members, setMembers] = useState<MemberDraft[]>(() => Array.from({ length: required }, emptyMember));
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const [reason, setReason] = useState("");
  const [requestId] = useState(newRequestId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { identities } = useEventIdentities(eventId);

  const buyerPayments = useMemo(
    () => payments.filter(payment => payment.userId === buyerId && payment.status === "paid"),
    [payments, buyerId]
  );
  const complete = membersComplete(members, required);
  const canSubmit = !busy && (complete || (required > 1 && allowIncomplete && membersPayload(members).length > 0)) && (status === "offered" || !!paymentId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await assignSlots({
        eventId,
        requestId,
        buyerId: buyerId || null,
        status,
        paymentId: status === "paid" ? paymentId : null,
        assignments: [{ slotId: slot.id, participants: membersPayload(members), allowIncomplete: required > 1 && allowIncomplete }],
        reason,
      });
      onDone(status === "paid" ? "Créneau rattaché au paiement de l'acheteur." : "Créneau attribué (offert).");
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Attribuer le créneau">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative z-10 grid max-h-[92vh] w-full max-w-lg gap-4 overflow-y-auto rounded-lg border bg-card p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Attribuer le créneau</h2>
            <p className="text-sm text-muted-foreground">
              {category?.name ?? slot.categoryId} · {slot.date} · {formatTime(slot.startTime)}
              {required > 1 ? ` · équipe de ${required}` : ""}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fermer"><X className="h-4 w-4" /></Button>
        </div>

        <label className="grid gap-1 text-sm font-medium">
          Compte responsable (acheteur)
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={buyerId} onChange={event => { setBuyerId(event.target.value); setPaymentId(""); }}>
            <option value="">— Aucun compte —</option>
            {users.map(user => <option key={user.id} value={user.id}>{formatUser(user)} ({user.email})</option>)}
          </select>
        </label>

        <fieldset className="grid gap-2 text-sm">
          <legend className="font-medium">Statut</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="status" checked={status === "offered"} onChange={() => setStatus("offered")} />
            <Gift className="h-4 w-4 text-purple-600" /> Offert (aucun paiement)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="status" checked={status === "paid"} disabled={!buyerId} onChange={() => setStatus("paid")} />
            <CreditCard className="h-4 w-4 text-green-600" /> Rattaché à un paiement réel de l&apos;acheteur
          </label>
          {status === "paid" && (
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Paiement de l'acheteur" value={paymentId} onChange={event => setPaymentId(event.target.value)}>
              <option value="">— Choisir le paiement —</option>
              {buyerPayments.map(payment => (
                <option key={payment.id} value={payment.id}>
                  {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString("fr-FR") : ""} · {payment.amount} € · {payment.stripeSessionId?.slice(0, 18) ?? payment.id}
                </option>
              ))}
            </select>
          )}
          {status === "paid" && buyerPayments.length === 0 && <p className="text-xs text-amber-700">Aucun paiement réel pour ce compte dans cette édition : choisissez « Offert ».</p>}
        </fieldset>

        <MemberFields count={required} members={members} onChange={setMembers} identities={identities} preferredBuyerId={buyerId} />
        {required > 1 && (
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={allowIncomplete} onChange={event => setAllowIncomplete(event.target.checked)} />
            Équipier inconnu pour l&apos;instant : enregistrer une équipe incomplète (signalée, à compléter dans Participants).
          </label>
        )}
        <input className="h-9 rounded-md border border-input bg-background px-2 text-sm" placeholder="Motif (facultatif, conservé dans l'historique)" aria-label="Motif" value={reason} onChange={event => setReason(event.target.value)} />

        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={!canSubmit}>{busy ? "Enregistrement…" : "Attribuer"}</Button>
        </div>
      </form>
    </div>
  );
}
