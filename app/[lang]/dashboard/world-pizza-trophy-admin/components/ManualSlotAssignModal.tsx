"use client";

// Attribution de plusieurs créneaux libres à un compte (page Utilisateurs).
// Une seule transaction serveur : tout est attribué, ou rien. Pour une
// catégorie à plusieurs, tous les équipiers sont saisis ici.

import React, { useMemo, useState } from "react";
import { X, Gift, CreditCard } from "lucide-react";
import { Button } from "./ui/Button";
import { MemberFields, membersComplete } from "./MemberFields";
import { assignSlots, emptyMember, membersPayload, useEventIdentities, type MemberDraft } from "../lib/assignSlots";
import { newRequestId } from "../lib/adminFetch";
import { cn, formatTime, formatUser } from "../lib/utils";
import { getParticipantsPerSlot } from "@/lib/booking/rules";
import type { Category, Payment, Slot, User } from "@/types/firestore";

interface ManualSlotAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
  user: User | null;
  slots: Slot[];
  categories?: Category[];
  payments?: Payment[];
  eventId: string;
}

export function ManualSlotAssignModal(props: ManualSlotAssignModalProps) {
  if (!props.isOpen || !props.user) return null;
  return <ManualSlotAssignForm key={props.user.id} {...props} user={props.user} />;
}

function ManualSlotAssignForm({ onClose, onDone, user, slots, categories = [], payments = [], eventId }: ManualSlotAssignModalProps & { user: User }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [members, setMembers] = useState<Record<string, MemberDraft[]>>({});
  const [status, setStatus] = useState<"offered" | "paid">("offered");
  const [paymentId, setPaymentId] = useState("");
  const [reason, setReason] = useState("");
  const [requestId] = useState(newRequestId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { identities } = useEventIdentities(eventId);

  const availableSlots = useMemo(
    () => slots.filter(slot => slot.status === "available").sort((a, b) => a.date.localeCompare(b.date) || a.startTime.getTime() - b.startTime.getTime()),
    [slots]
  );
  const category = (slot: Slot) => categories.find(item => item.id === slot.categoryId);
  const required = (slot: Slot) => getParticipantsPerSlot(category(slot));
  const userPayments = payments.filter(payment => payment.userId === user.id && payment.status === "paid");
  const ready =
    selected.length > 0 &&
    selected.every(slotId => {
      const slot = availableSlots.find(item => item.id === slotId);
      return !!slot && membersComplete(members[slotId] ?? [], required(slot));
    }) &&
    (status === "offered" || !!paymentId);

  const toggle = (slot: Slot) => {
    setSelected(previous => (previous.includes(slot.id) ? previous.filter(id => id !== slot.id) : [...previous, slot.id]));
    setMembers(previous => (previous[slot.id] ? previous : { ...previous, [slot.id]: Array.from({ length: required(slot) }, emptyMember) }));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await assignSlots({
        eventId,
        requestId,
        buyerId: user.id,
        status,
        paymentId: status === "paid" ? paymentId : null,
        assignments: selected.map(slotId => ({ slotId, participants: membersPayload(members[slotId] ?? []) })),
        reason,
      });
      onDone(`${selected.length} créneau(x) attribué(s) à ${formatUser(user)}.`);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Attribuer des créneaux">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-lg border bg-card p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Attribuer des créneaux — {formatUser(user)}</h2>
            <p className="text-sm text-muted-foreground">Créneaux libres uniquement. Tout est enregistré en une fois, ou rien si un créneau a été pris entre-temps.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fermer"><X className="h-4 w-4" /></Button>
        </div>

        <fieldset className="grid gap-2 text-sm">
          <legend className="font-medium">Statut</legend>
          <label className="flex items-center gap-2"><input type="radio" checked={status === "offered"} onChange={() => setStatus("offered")} /><Gift className="h-4 w-4 text-purple-600" /> Offert</label>
          <label className="flex items-center gap-2"><input type="radio" checked={status === "paid"} onChange={() => setStatus("paid")} /><CreditCard className="h-4 w-4 text-green-600" /> Rattaché à un paiement réel de ce compte</label>
          {status === "paid" && (
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Paiement" value={paymentId} onChange={event => setPaymentId(event.target.value)}>
              <option value="">— Choisir le paiement —</option>
              {userPayments.map(payment => <option key={payment.id} value={payment.id}>{payment.amount} € · {payment.stripeSessionId?.slice(0, 18) ?? payment.id}</option>)}
            </select>
          )}
        </fieldset>

        <div className="grid gap-2">
          {availableSlots.length === 0 && <p className="text-sm text-muted-foreground">Aucun créneau libre.</p>}
          {availableSlots.map(slot => {
            const isSelected = selected.includes(slot.id);
            return (
              <div key={slot.id} className={cn("rounded-md border p-3", isSelected && "border-primary bg-primary/5")}>
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <input type="checkbox" checked={isSelected} onChange={() => toggle(slot)} />
                  <span className="font-medium">{category(slot)?.name ?? slot.categoryId}</span>
                  <span className="text-muted-foreground">{slot.date} · {formatTime(slot.startTime)}</span>
                  {required(slot) > 1 && <span className="text-xs text-blue-700">équipe de {required(slot)}</span>}
                </label>
                {isSelected && (
                  <div className="mt-3">
                    <MemberFields
                      count={required(slot)}
                      members={members[slot.id] ?? []}
                      onChange={next => setMembers(previous => ({ ...previous, [slot.id]: next }))}
                      identities={identities}
                      preferredBuyerId={user.id}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <input className="h-9 rounded-md border border-input bg-background px-2 text-sm" placeholder="Motif (facultatif)" aria-label="Motif" value={reason} onChange={event => setReason(event.target.value)} />
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="button" disabled={!ready || busy} onClick={submit}>{busy ? "Enregistrement…" : `Attribuer ${selected.length} créneau(x)`}</Button>
        </div>
      </div>
    </div>
  );
}
