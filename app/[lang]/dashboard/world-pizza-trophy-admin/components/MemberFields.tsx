"use client";

// Saisie des participants d'un créneau : un pour une catégorie individuelle,
// TOUS les équipiers pour une catégorie à plusieurs (Pizza Due).

import React from "react";
import { emptyMember, type EventIdentity, type MemberDraft } from "../lib/assignSlots";

const SIZES = ["", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const inputClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function MemberFields({
  count,
  members,
  onChange,
  identities,
  preferredBuyerId,
  singleLabel = "Participant",
}: {
  singleLabel?: string;
  count: number;
  members: MemberDraft[];
  onChange: (members: MemberDraft[]) => void;
  identities: EventIdentity[];
  preferredBuyerId?: string | null;
}) {
  const rows = Array.from({ length: count }, (_, index) => members[index] ?? emptyMember());
  const update = (index: number, patch: Partial<MemberDraft>) => onChange(rows.map((row, current) => (current === index ? { ...row, ...patch } : row)));
  const sorted = [...identities].sort(
    (a, b) =>
      Number(b.buyers.some(buyer => buyer.id === preferredBuyerId)) - Number(a.buyers.some(buyer => buyer.id === preferredBuyerId)) ||
      a.displayName.localeCompare(b.displayName, "fr")
  );

  return (
    <div className="grid gap-3">
      {rows.map((row, index) => (
        <fieldset key={index} className="grid gap-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">{count > 1 ? `Équipier ${index + 1}` : singleLabel}</legend>
          <select
            className={inputClass}
            aria-label={`Participant existant ${index + 1}`}
            value={row.participantId}
            onChange={event => update(index, { participantId: event.target.value })}
          >
            <option value="">— Nouveau participant (saisir ci-dessous) —</option>
            {sorted.map(identity => (
              <option key={identity.id} value={identity.id}>
                {identity.displayName}{identity.bib ? ` (n° ${identity.bib})` : ""}
              </option>
            ))}
          </select>
          {!row.participantId && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_6rem]">
              <input className={inputClass} placeholder="NOM" aria-label={`Nom ${index + 1}`} value={row.lastName} onChange={event => update(index, { lastName: event.target.value })} />
              <input className={inputClass} placeholder="Prénom" aria-label={`Prénom ${index + 1}`} value={row.firstName} onChange={event => update(index, { firstName: event.target.value })} />
              <select className={inputClass} aria-label={`Taille de t-shirt ${index + 1}`} value={row.shirtSize} onChange={event => update(index, { shirtSize: event.target.value })}>
                {SIZES.map(size => <option key={size} value={size}>{size || "Taille"}</option>)}
              </select>
            </div>
          )}
        </fieldset>
      ))}
    </div>
  );
}

export function membersComplete(members: MemberDraft[], count: number): boolean {
  return Array.from({ length: count }, (_, index) => members[index]).every(
    member => !!member && (!!member.participantId || (!!member.firstName.trim() && !!member.lastName.trim()))
  );
}
