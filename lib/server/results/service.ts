// lib/server/results/service.ts
// Résultats d'une édition : brouillon → validé → publié, par catégorie.
// Un import n'est jamais publié automatiquement. Le public ne lit que les
// versions publiées ; les noms affichés viennent des identités (corrections
// comprises) et chaque publication conserve la précédente pour la traçabilité.

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { displayName } from "@/lib/domain/names";
import { validateResults, type IdentityIndexEntry, type MatchedLine, type ResultLine } from "@/lib/domain/results";
import { acceptsResults } from "@/lib/domain/event-lifecycle";
import { ParticipantActionError, type ActionContext } from "@/lib/server/participants/service";

export const resultSetId = (eventId: string, categoryKey: string) => `${eventId}_${categoryKey}`;

export async function buildIdentityIndex(db: Firestore, eventId: string): Promise<IdentityIndexEntry[]> {
  const [participants, teams, slots] = await Promise.all([
    db.collection("participants").where("eventId", "==", eventId).get(),
    db.collection("teams").where("eventId", "==", eventId).get(),
    db.collection("slots").where("eventId", "==", eventId).get(),
  ]);
  const categoriesByParticipant = new Map<string, Set<string>>();
  slots.docs.forEach(slot => {
    const data = slot.data();
    if (data.status === "available") return;
    (data.participantIds ?? []).forEach((id: string) => categoriesByParticipant.set(id, new Set([...(categoriesByParticipant.get(id) ?? []), data.categoryId])));
  });
  const people = new Map(participants.docs.map(doc => [doc.id, doc.data()]));
  return [
    ...participants.docs.map(doc => ({
      kind: "participant" as const,
      id: doc.id,
      bib: typeof doc.data().bib === "number" ? doc.data().bib : null,
      names: [{ firstName: doc.data().firstName, lastName: doc.data().lastName }],
      categoryIds: [...(categoriesByParticipant.get(doc.id) ?? [])],
      withdrawn: !!doc.data().withdrawn,
    })),
    ...teams.docs.map(doc => {
      const data = doc.data();
      return {
        kind: "team" as const,
        id: doc.id,
        bib: typeof data.bib === "number" ? data.bib : null,
        names: (data.memberIds ?? []).map((id: string) => people.get(id)).filter(Boolean).map((person: { firstName: string; lastName: string }) => ({ firstName: person.firstName, lastName: person.lastName })),
        displayName: data.displayName ?? null,
        categoryIds: [data.categoryId],
      };
    }),
  ];
}

export interface DraftInput {
  eventId: string;
  categoryKey: string;
  categoryId: string | null;
  categoryName: string;
  kind: "individual" | "team";
  lines: ResultLine[];
  /** Index des lignes dont l'administrateur a confirmé le rapprochement proposé. */
  confirmedLines?: number[];
  /** Rapprochements choisis à la main (index de ligne → identité). */
  manualMatches?: Record<number, { holderKind: "participant" | "team"; holderId: string }>;
  source: string;
}

export async function saveResultDraft(db: Firestore, input: DraftInput, context: ActionContext) {
  const event = await db.collection("events").doc(input.eventId).get();
  if (!event.exists) throw new ParticipantActionError(404, "Édition introuvable.", "not_found");
  if (!acceptsResults(event.data()!.status)) {
    throw new ParticipantActionError(409, "Les résultats se saisissent une fois les inscriptions closes.", "event_not_finished");
  }
  const index = await buildIdentityIndex(db, input.eventId);
  // Les décisions de l'administrateur sont revalidées comme un rapprochement automatique.
  const validation = validateResults(
    { categoryId: input.categoryId, kind: input.kind, lines: input.lines },
    index,
    { confirmedLines: input.confirmedLines, manualMatches: input.manualMatches }
  );
  const { lines, blocking } = validation;

  const at = Timestamp.fromDate(context.now ?? new Date());
  const ref = db.collection("resultSets").doc(resultSetId(input.eventId, input.categoryKey));
  await db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    tx.set(
      ref,
      {
        eventId: input.eventId,
        categoryKey: input.categoryKey,
        categoryId: input.categoryId,
        categoryName: input.categoryName,
        kind: input.kind,
        status: "draft",
        draft: { lines, blocking, warnings: validation.warnings, source: input.source, updatedAt: at, updatedBy: context.actor.uid },
        draftVersion: (existing.data()?.draftVersion ?? 0) + 1,
        // Une version publiée reste en ligne pendant qu'une correction est préparée.
        published: existing.data()?.published ?? null,
        isPublished: !!existing.data()?.published,
      },
      { merge: false }
    );
  });
  return { id: ref.id, blocking, warnings: validation.warnings, lines };
}

export async function validateResultSet(db: Firestore, input: { id: string; expectedDraftVersion: number }, context: ActionContext) {
  const ref = db.collection("resultSets").doc(input.id);
  const at = Timestamp.fromDate(context.now ?? new Date());
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new ParticipantActionError(404, "Résultats introuvables.", "not_found");
    const data = snapshot.data()!;
    if (data.draftVersion !== input.expectedDraftVersion) throw new ParticipantActionError(409, "Le brouillon a changé : relisez-le avant de valider.", "version_conflict");
    if ((data.draft?.blocking ?? []).length > 0) throw new ParticipantActionError(409, "Des points bloquants restent à résoudre.", "blocking_issues", { blocking: data.draft.blocking });
    tx.update(ref, { status: "validated", validatedAt: at, validatedBy: context.actor.uid });
    return { status: "validated" };
  });
}

/** Publication d'une catégorie validée. La version précédente est archivée (correction tracée). */
export async function publishResultSet(db: Firestore, input: { id: string }, context: ActionContext) {
  const ref = db.collection("resultSets").doc(input.id);
  const at = Timestamp.fromDate(context.now ?? new Date());
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new ParticipantActionError(404, "Résultats introuvables.", "not_found");
    const data = snapshot.data()!;
    if (data.status !== "validated") throw new ParticipantActionError(409, "Validez les résultats avant de les publier.", "not_validated");
    const version = (data.published?.version ?? 0) + 1;
    // Données publiques uniquement : ni notes de juges, ni coordonnées, ni remarques internes.
    const lines = (data.draft.lines as MatchedLine[]).map(line => ({
      rank: line.rank, status: line.status, points: line.points, bib: line.bib, name: line.name,
      distinction: line.distinction ?? null, holderKind: line.holderKind, holderId: line.holderId,
    }));
    if (data.published) {
      tx.create(db.collection("resultRevisions").doc(`${input.id}_v${data.published.version}`), { resultSetId: input.id, ...data.published, supersededAt: at, supersededBy: context.actor.uid });
    }
    tx.update(ref, { status: "published", isPublished: true, published: { version, lines, publishedAt: at, publishedBy: context.actor.uid } });
    tx.set(db.collection("auditLogs").doc(), {
      eventId: data.eventId, entity: "result", entityId: input.id, action: version === 1 ? "results.publish" : "results.correct",
      actorUid: context.actor.uid, actorName: context.actor.displayName, before: data.published ? { version: data.published.version } : null,
      after: { version, lines: lines.length }, reason: context.reason ?? null, at,
    });
    return { version };
  });
}

export interface PublicResultLine {
  rank: number | null;
  status: string;
  points: number | null;
  bib: number | null;
  name: string;
  distinction: string | null;
  members?: string[];
}

/** Vue publique : catégories publiées seulement, noms à jour des identités. */
export async function publicResults(db: Firestore, eventId: string) {
  const [sets, index] = await Promise.all([
    db.collection("resultSets").where("eventId", "==", eventId).where("isPublished", "==", true).get(),
    buildIdentityIndex(db, eventId),
  ]);
  const byId = new Map(index.map(entry => [entry.id, entry]));
  return sets.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      categoryKey: data.categoryKey as string,
      categoryName: data.categoryName as string,
      kind: data.kind as "individual" | "team",
      version: data.published.version as number,
      publishedAt: data.published.publishedAt?.toDate?.().toISOString() ?? null,
      lines: (data.published.lines as (PublicResultLine & { holderId: string | null })[]).map(line => {
        const holder = line.holderId ? byId.get(line.holderId) : undefined;
        const members = holder?.kind === "team" ? holder.names.map(displayName) : undefined;
        const name = holder ? holder.displayName || holder.names.map(displayName).join(" – ") : line.name;
        return { rank: line.rank, status: line.status, points: line.points, bib: line.bib, name, distinction: line.distinction ?? null, ...(members ? { members } : {}) };
      }),
    };
  });
}

/** Résultats publiés d'une identité (fiche participant) : individuels et équipes dont il est membre. */
export async function resultsOfParticipant(db: Firestore, eventId: string, participantId: string) {
  const teams = await db.collection("teams").where("memberIds", "array-contains", participantId).get();
  const holderIds = new Set([participantId, ...teams.docs.filter(doc => doc.data().eventId === eventId).map(doc => doc.id)]);
  const published = await publicResults(db, eventId);
  const sets = await db.collection("resultSets").where("eventId", "==", eventId).where("isPublished", "==", true).get();
  const holdersBySet = new Map(sets.docs.map(doc => [doc.id, (doc.data().published.lines as { holderId: string | null }[]).map(line => line.holderId)]));
  return published.flatMap(set =>
    set.lines.filter((_, position) => holderIds.has(holdersBySet.get(set.id)?.[position] ?? "")).map(line => ({ categoryName: set.categoryName, kind: set.kind, ...line }))
  );
}
