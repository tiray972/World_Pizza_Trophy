// Attribution manuelle de créneaux : un seul chemin serveur pour la fiche
// créneau, la page Utilisateurs et la matrice (contrôles et transaction côté serveur).
import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "./adminFetch";
import type { AssignedPerson, ManualAssignmentInput, ManualAssignmentResult } from "@/lib/server/slots/assign";

export type { AssignedPerson };

export interface MemberDraft {
  participantId: string;
  firstName: string;
  lastName: string;
  shirtSize: string;
}

export const emptyMember = (): MemberDraft => ({ participantId: "", firstName: "", lastName: "", shirtSize: "" });

export function membersPayload(members: MemberDraft[]): AssignedPerson[] {
  return members
    .map(member =>
      member.participantId
        ? { participantId: member.participantId }
        : { firstName: member.firstName.trim(), lastName: member.lastName.trim(), ...(member.shirtSize ? { shirtSize: member.shirtSize } : {}) }
    )
    .filter(person => "participantId" in person || (person.firstName && person.lastName));
}

export function assignSlots(input: ManualAssignmentInput & { reason?: string }) {
  return adminFetch<ManualAssignmentResult>("/api/admin/slots/assign", { body: input });
}

export interface EventIdentity {
  id: string;
  displayName: string;
  bib: number | null;
  withdrawn: boolean;
  buyers: { id: string }[];
}

/** Identités de l'édition, pour choisir un participant existant plutôt que retaper son nom. */
export function useEventIdentities(eventId: string | undefined, enabled = true) {
  const [identities, setIdentities] = useState<EventIdentity[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!eventId || !enabled) return;
    let cancelled = false;
    adminFetch<{ participants: EventIdentity[] }>(`/api/admin/participants?eventId=${encodeURIComponent(eventId)}`)
      .then(data => !cancelled && setIdentities(data.participants.filter(participant => !participant.withdrawn)))
      .catch(() => !cancelled && setIdentities([]));
    return () => {
      cancelled = true;
    };
  }, [eventId, enabled, version]);
  const reload = useCallback(() => setVersion(value => value + 1), []);
  return { identities, reload };
}
