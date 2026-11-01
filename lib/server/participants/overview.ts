// lib/server/participants/overview.ts
// Vue administrateur des identités d'une édition : participants, équipes,
// inscriptions, doublons possibles (signalés, jamais fusionnés) et créneaux
// historiques encore sans identité (à migrer).

import type { Firestore } from "firebase-admin/firestore";
import { displayName, looseNameKey } from "@/lib/domain/names";
import { getSlotParticipants } from "@/lib/booking/rules";

const iso = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return value instanceof Date ? value.toISOString() : null;
};

export interface IdentityOverview {
  participants: Array<{
    id: string;
    firstName: string;
    lastName: string;
    displayName: string;
    bib: number | null;
    shirtSize: string | null;
    withdrawn: boolean;
    createdFrom: string;
    version: number;
    buyers: Array<{ id: string; label: string }>;
    entries: Array<{ slotId: string; categoryId: string; categoryName: string; date: string; startTime: string | null; status: string; teamId: string | null }>;
    mealSeats: number;
  }>;
  teams: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    slotId: string | null;
    memberIds: string[];
    requiredMembers: number;
    status: string;
    bib: number | null;
    displayName: string | null;
    version: number;
  }>;
  possibleDuplicates: Array<{ key: string; participantIds: string[] }>;
  legacySlots: Array<{ slotId: string; categoryName: string; date: string; status: string; names: string[] }>;
  auditLog: Array<{ id: string; entity: string; entityId: string; action: string; actorName: string | null; before: unknown; after: unknown; reason: string | null; at: string | null }>;
}

export async function listEventIdentities(db: Firestore, eventId: string): Promise<IdentityOverview> {
  const [participants, teams, slots, categories, seats, logs] = await Promise.all([
    db.collection("participants").where("eventId", "==", eventId).get(),
    db.collection("teams").where("eventId", "==", eventId).get(),
    db.collection("slots").where("eventId", "==", eventId).get(),
    db.collection("categories").where("eventId", "==", eventId).get(),
    db.collection("mealSeats").where("eventId", "==", eventId).get(),
    db.collection("auditLogs").where("eventId", "==", eventId).get(),
  ]);

  const categoryName = new Map(categories.docs.map(doc => [doc.id, String(doc.data().name || doc.id)]));
  const buyerIds = Array.from(new Set(participants.docs.flatMap(doc => (doc.data().buyerIds as string[]) ?? [])));
  const buyers = buyerIds.length
    ? await db.getAll(...buyerIds.map(id => db.collection("users").doc(id)))
    : [];
  const buyerLabel = new Map(
    buyers.map(doc => {
      const data = doc.data() || {};
      const name = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
      return [doc.id, name ? `${name} (${data.email || doc.id})` : String(data.email || doc.id)];
    })
  );

  const entriesByParticipant = new Map<string, IdentityOverview["participants"][number]["entries"]>();
  const legacySlots: IdentityOverview["legacySlots"] = [];
  slots.docs.forEach(doc => {
    const data = doc.data();
    if (data.status === "available") return;
    const ids: string[] = data.participantIds ?? [];
    if (ids.length === 0) {
      const names = getSlotParticipants({ ...data, status: data.status } as never).map(participant => displayName(participant));
      if (names.length > 0) {
        legacySlots.push({ slotId: doc.id, categoryName: categoryName.get(data.categoryId) ?? data.categoryId, date: data.date, status: data.status, names });
      }
      return;
    }
    ids.forEach(id => {
      const list = entriesByParticipant.get(id) ?? [];
      list.push({
        slotId: doc.id,
        categoryId: data.categoryId,
        categoryName: categoryName.get(data.categoryId) ?? data.categoryId,
        date: data.date,
        startTime: iso(data.startTime),
        status: data.status,
        teamId: data.teamId ?? null,
      });
      entriesByParticipant.set(id, list);
    });
  });

  const seatsByParticipant = new Map<string, number>();
  seats.docs.forEach(doc => {
    const id = doc.data().beneficiaryParticipantId;
    if (id && doc.data().financialStatus === "paid") seatsByParticipant.set(id, (seatsByParticipant.get(id) ?? 0) + 1);
  });

  const byLooseKey = new Map<string, string[]>();
  const participantList = participants.docs.map(doc => {
    const data = doc.data();
    const key = data.looseNameKey || looseNameKey(data);
    byLooseKey.set(key, [...(byLooseKey.get(key) ?? []), doc.id]);
    return {
      id: doc.id,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: displayName(data),
      bib: typeof data.bib === "number" ? data.bib : null,
      shirtSize: data.shirtSize ?? null,
      withdrawn: !!data.withdrawn,
      createdFrom: data.createdFrom ?? "checkout",
      version: data.version ?? 1,
      buyers: ((data.buyerIds as string[]) ?? []).map(id => ({ id, label: buyerLabel.get(id) ?? id })),
      entries: (entriesByParticipant.get(doc.id) ?? []).sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")),
      mealSeats: seatsByParticipant.get(doc.id) ?? 0,
    };
  });

  return {
    participants: participantList.sort((a, b) => a.displayName.localeCompare(b.displayName, "fr")),
    teams: teams.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        categoryId: data.categoryId,
        categoryName: categoryName.get(data.categoryId) ?? data.categoryId,
        slotId: data.slotId ?? null,
        memberIds: data.memberIds ?? [],
        requiredMembers: data.requiredMembers ?? 2,
        status: data.status ?? "incomplete",
        bib: typeof data.bib === "number" ? data.bib : null,
        displayName: data.displayName ?? null,
        version: data.version ?? 1,
      };
    }),
    possibleDuplicates: Array.from(byLooseKey.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([key, participantIds]) => ({ key, participantIds })),
    legacySlots,
    auditLog: logs.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          entity: data.entity,
          entityId: data.entityId,
          action: data.action,
          actorName: data.actorName ?? null,
          before: data.before ?? null,
          after: data.after ?? null,
          reason: data.reason ?? null,
          at: iso(data.at),
        };
      })
      .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")),
  };
}
