// lib/server/migrations/identities.ts
// Migration d'une édition existante vers les identités stables :
// participants, équipes, dossards et places repas.
//
// 1. `planIdentityMigration` LIT la base et produit un plan + un rapport
//    (aucune écriture). Le plan a une empreinte.
// 2. `applyIdentityMigration` n'écrit que si l'empreinte fournie correspond au
//    plan recalculé (rien n'a changé depuis la relecture). Identifiants
//    déterministes : relancer ne crée rien de plus.
//
// Règles de rapprochement (aucune ressemblance de nom) :
//  - même acheteur + même saisie stricte (casse/espaces) = même identité ;
//  - même saisie stricte chez plusieurs acheteurs = même identité SEULEMENT si
//    le planning officiel donne un dossard unique à ce nom ; sinon identités
//    séparées et ambiguïté signalée ;
//  - variantes d'accents ou d'orthographe : jamais fusionnées, signalées ;
//  - dossards : uniquement depuis les documents de référence fournis, par nom
//    strict ; toute contradiction entre sources est signalée, jamais tranchée ;
//  - corrections, retraits et ajouts tardifs : uniquement ceux confirmés dans
//    le fichier de décisions de l'organisateur.

import { createHash } from "node:crypto";
import { Timestamp, type Firestore, type WriteBatch } from "firebase-admin/firestore";
import { canonicalName, displayName, isNameComplete, looseNameKey, strictNameKey, type PersonName } from "@/lib/domain/names";
import { getParticipantsPerSlot } from "@/lib/booking/rules";
import { canonicalPayments, derivedSeats, type PaymentView } from "@/lib/domain/meals";

export interface BibReference {
  kind: "individual" | "team";
  bib: number;
  names: PersonName[];
  /** Fichier / feuille d'origine, cité dans le rapport. */
  source: string;
  /**
   * 1 = document opérationnel (planning imprimé depuis la base, utilisé le jour J) ;
   * 2 = document secondaire (résultats transcrits) : complète ou contrôle, sans primer.
   */
  priority?: number;
}

export interface MigrationDecisions {
  renames?: Array<{ from: PersonName; to: PersonName; evidence: string }>;
  withdrawn?: Array<{ name: PersonName; evidence: string }>;
  teamDisplayNames?: Array<{ bib: number; displayName: string; evidence: string }>;
}

export type IssueKind =
  | "possible_duplicate"
  | "same_name_several_buyers"
  | "bib_conflict"
  | "spelling_mismatch"
  | "bib_not_found"
  | "team_incomplete"
  | "team_unmatched"
  | "duplicate_payment_record"
  | "meal_names_missing"
  | "withdrawn_still_booked"
  | "decision_not_applied"
  | "slot_without_name";

export interface MigrationIssue {
  kind: IssueKind;
  message: string;
  refs: string[];
}

export interface PlannedParticipant {
  id: string;
  name: PersonName;
  enteredAs: PersonName;
  buyerIds: string[];
  slotIds: string[];
  shirtSize: string | null;
  bib: number | null;
  bibSource: string | null;
  renamedBy: string | null;
  withdrawn: boolean;
}

export interface PlannedTeam {
  id: string;
  slotId: string;
  categoryId: string;
  memberIds: string[];
  requiredMembers: number;
  status: "complete" | "incomplete";
  bib: number | null;
  bibSource: string | null;
  displayName: string | null;
}

export interface MigrationPlan {
  eventId: string;
  participants: PlannedParticipant[];
  teams: PlannedTeam[];
  slots: Array<{ slotId: string; participantIds: string[]; teamId: string | null }>;
  mealSeats: Array<{ paymentId: string; seats: number; named: number }>;
  issues: MigrationIssue[];
  stats: Record<string, number>;
  fingerprint: string;
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

/** Ensemble des porteurs d'une référence (clé tolérante, pour comparer des sources). */
const holderSet = (reference: BibReference) => new Set(reference.names.map(looseNameKey));
const includes = (outer: Set<string>, inner: Set<string>) => [...inner].every(key => outer.has(key));

function bibIndex(references: BibReference[], issues: MigrationIssue[]) {
  const byBib = new Map<number, BibReference[]>();
  references.forEach(reference => byBib.set(reference.bib, [...(byBib.get(reference.bib) ?? []), reference]));

  // Pour chaque numéro : les références de plus haute priorité font foi ; deux
  // références de même priorité incompatibles (porteurs différents, l'une ne
  // complétant pas l'autre) = contradiction, numéro non attribué.
  const retained: BibReference[] = [];
  for (const [bib, entries] of byBib) {
    const best = Math.min(...entries.map(entry => entry.priority ?? 1));
    const primary = entries.filter(entry => (entry.priority ?? 1) === best);
    const secondary = entries.filter(entry => (entry.priority ?? 1) !== best);
    const compatible = (a: BibReference, b: BibReference) =>
      a.kind === b.kind && (includes(holderSet(a), holderSet(b)) || includes(holderSet(b), holderSet(a)));
    const conflict = primary.some(a => primary.some(b => !compatible(a, b)));
    if (conflict) {
      issues.push({
        kind: "bib_conflict",
        message: `Dossard ${bib} : sources contradictoires (${primary.map(entry => `${entry.names.map(displayName).join(" – ")} — ${entry.source}`).join(" ; ")}). Non attribué.`,
        refs: primary.map(entry => entry.source),
      });
      continue;
    }
    retained.push(...primary);
    for (const other of secondary) {
      const reference = primary[0];
      if (!compatible(reference, other)) {
        issues.push({
          kind: other.kind === reference.kind ? "spelling_mismatch" : "bib_conflict",
          message: `Dossard ${bib} : « ${reference.names.map(displayName).join(" – ")} » (${reference.source}) écrit « ${other.names.map(displayName).join(" – ")} » dans ${other.source}. Le document opérationnel fait foi ; orthographe à arbitrer.`,
          refs: [reference.source, other.source],
        });
      } else if (other.kind === "team" && other.names.length > reference.names.length) {
        // Un document secondaire complète une équipe (équipier manquant) : il est retenu en plus.
        retained.push(other);
      } else if (other.names.map(strictNameKey).sort().join("+") !== reference.names.map(strictNameKey).sort().join("+")) {
        issues.push({
          kind: "spelling_mismatch",
          message: `Dossard ${bib} : accents ou casse différents — « ${reference.names.map(displayName).join(" – ")} » (${reference.source}) / « ${other.names.map(displayName).join(" – ")} » (${other.source}).`,
          refs: [reference.source, other.source],
        });
      }
    }
  }

  const individual = new Map<string, Set<number>>();
  const individualSources = new Map<string, string[]>();
  retained
    .filter(reference => reference.kind === "individual" && reference.names.length === 1)
    .forEach(reference => {
      const key = strictNameKey(reference.names[0]);
      individual.set(key, new Set([...(individual.get(key) ?? []), reference.bib]));
      individualSources.set(key, Array.from(new Set([...(individualSources.get(key) ?? []), reference.source])));
    });
  for (const [key, bibs] of individual) {
    if (bibs.size > 1) {
      issues.push({ kind: "bib_conflict", message: `Nom « ${key} » associé à plusieurs dossards (${[...bibs].join(", ")}). Non attribué.`, refs: individualSources.get(key) ?? [] });
    }
  }
  const individualBib = (name: PersonName): { bib: number; source: string } | null => {
    const key = strictNameKey(name);
    const bibs = individual.get(key);
    if (!bibs || bibs.size !== 1) return null;
    return { bib: [...bibs][0], source: (individualSources.get(key) ?? []).join(", ") };
  };
  const teams = retained.filter(reference => reference.kind === "team");
  return { individualBib, teams };
}

export async function planIdentityMigration(
  db: Firestore,
  eventId: string,
  options: { references?: BibReference[]; decisions?: MigrationDecisions } = {}
): Promise<MigrationPlan> {
  const issues: MigrationIssue[] = [];
  const decisions = options.decisions ?? {};
  const [slotsSnapshot, categoriesSnapshot, existingParticipants, paymentsSnapshot, seatsSnapshot] = await Promise.all([
    db.collection("slots").where("eventId", "==", eventId).get(),
    db.collection("categories").where("eventId", "==", eventId).get(),
    db.collection("participants").where("eventId", "==", eventId).get(),
    db.collection("payments").where("eventId", "==", eventId).get(),
    db.collection("mealSeats").where("eventId", "==", eventId).get(),
  ]);
  const categories = new Map(categoriesSnapshot.docs.map(doc => [doc.id, doc.data()]));
  const { individualBib, teams: teamReferences } = bibIndex(options.references ?? [], issues);

  // Créneaux occupés, sans identité, triés pour un résultat stable.
  const legacySlots = slotsSnapshot.docs
    .filter(doc => ["paid", "offered"].includes(doc.data().status) && !(doc.data().participantIds?.length > 0))
    .sort((a, b) => a.id.localeCompare(b.id));

  type Entry = { slotId: string; buyerId: string; raw: PersonName; shirtSize: string | null };
  const entriesBySlot = new Map<string, Entry[]>();
  for (const slot of legacySlots) {
    const data = slot.data();
    const list = (Array.isArray(data.participants) && data.participants.length > 0 ? data.participants : data.participant ? [data.participant] : []) as Array<PersonName & { shirtSize?: string }>;
    const entries = list
      .filter(participant => isNameComplete(participant))
      .map(participant => ({ slotId: slot.id, buyerId: data.buyerId || "", raw: { firstName: participant.firstName, lastName: participant.lastName }, shirtSize: participant.shirtSize ?? null }));
    if (entries.length === 0) {
      issues.push({ kind: "slot_without_name", message: `Créneau ${slot.id} (${data.status}) sans participant nommé.`, refs: [slot.id] });
    }
    entriesBySlot.set(slot.id, entries);
  }

  const renameFor = (name: PersonName) =>
    (decisions.renames ?? []).find(rename => strictNameKey(rename.from) === strictNameKey(name));
  const withdrawnFor = (name: PersonName) =>
    (decisions.withdrawn ?? []).find(entry => strictNameKey(entry.name) === strictNameKey(name));

  // Regroupement : (acheteur, nom strict), puis fusion entre acheteurs seulement sur preuve de dossard unique.
  const groups = new Map<string, Entry[]>();
  for (const entries of entriesBySlot.values()) {
    for (const entry of entries) {
      const key = `${entry.buyerId}::${strictNameKey(entry.raw)}`;
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
  }
  const byStrictName = new Map<string, string[]>();
  for (const key of groups.keys()) {
    const nameKey = key.split("::")[1];
    byStrictName.set(nameKey, [...(byStrictName.get(nameKey) ?? []), key]);
  }
  const identityKeyOf = new Map<string, string>();
  for (const [nameKey, groupKeys] of byStrictName) {
    const sample = groups.get(groupKeys[0])![0].raw;
    // La preuve se cherche sous le nom corrigé (le planning porte la bonne orthographe).
    const effective = canonicalName(renameFor(sample)?.to ?? sample);
    if (groupKeys.length > 1 && (individualBib(effective) || individualBib(sample))) {
      groupKeys.forEach(groupKey => identityKeyOf.set(groupKey, `name::${nameKey}`));
    } else {
      groupKeys.forEach(groupKey => identityKeyOf.set(groupKey, groupKey));
      if (groupKeys.length > 1) {
        issues.push({
          kind: "same_name_several_buyers",
          message: `${displayName(sample)} est inscrit par ${groupKeys.length} acheteurs différents, sans dossard unique pour le confirmer : identités laissées séparées.`,
          refs: groupKeys,
        });
      }
    }
  }

  const identities = new Map<string, PlannedParticipant>();
  for (const [groupKey, entries] of groups) {
    const identityKey = identityKeyOf.get(groupKey)!;
    const existing = identities.get(identityKey);
    if (existing) {
      existing.buyerIds = Array.from(new Set([...existing.buyerIds, ...entries.map(entry => entry.buyerId).filter(Boolean)]));
      existing.slotIds = Array.from(new Set([...existing.slotIds, ...entries.map(entry => entry.slotId)]));
      continue;
    }
    const raw = entries[0].raw;
    const rename = renameFor(raw);
    const name = canonicalName(rename ? rename.to : raw);
    const bib = individualBib(name) ?? individualBib(raw);
    identities.set(identityKey, {
      id: `mig_${hash(`${eventId}|${identityKey}`)}`,
      name,
      enteredAs: raw,
      buyerIds: Array.from(new Set(entries.map(entry => entry.buyerId).filter(Boolean))),
      slotIds: Array.from(new Set(entries.map(entry => entry.slotId))),
      shirtSize: entries.find(entry => entry.shirtSize)?.shirtSize ?? null,
      bib: bib?.bib ?? null,
      bibSource: bib?.source ?? null,
      renamedBy: rename?.evidence ?? null,
      withdrawn: !!withdrawnFor(raw),
    });
  }

  // Décisions non appliquées : elles ne doivent jamais créer une personne absente de la base.
  for (const rename of decisions.renames ?? []) {
    if (![...identities.values()].some(identity => strictNameKey(identity.enteredAs) === strictNameKey(rename.from))) {
      issues.push({ kind: "decision_not_applied", message: `Correction « ${displayName(rename.from)} → ${displayName(rename.to)} » : saisie introuvable dans la base.`, refs: [rename.evidence] });
    }
  }
  for (const entry of decisions.withdrawn ?? []) {
    const identity = [...identities.values()].find(candidate => strictNameKey(candidate.enteredAs) === strictNameKey(entry.name));
    if (!identity) {
      issues.push({ kind: "decision_not_applied", message: `Retrait de ${displayName(entry.name)} : absent de la base, rien à faire (il ne sera pas recréé).`, refs: [entry.evidence] });
    } else {
      issues.push({
        kind: "withdrawn_still_booked",
        message: `${displayName(entry.name)} est retiré du planning mais figure encore sur ${identity.slotIds.length} créneau(x) : fiche marquée « retiré », créneaux et paiements conservés en l'état, libération à décider par l'organisateur.`,
        refs: identity.slotIds,
      });
    }
  }

  // Doublons possibles : variantes d'accents ou de casse, jamais fusionnées.
  const byLoose = new Map<string, PlannedParticipant[]>();
  identities.forEach(identity => byLoose.set(looseNameKey(identity.name), [...(byLoose.get(looseNameKey(identity.name)) ?? []), identity]));
  for (const group of byLoose.values()) {
    if (group.length > 1) {
      issues.push({ kind: "possible_duplicate", message: `Doublon possible, non fusionné : ${group.map(identity => `${displayName(identity.enteredAs)} (${identity.slotIds.length} créneau(x))`).join(" / ")}.`, refs: group.map(identity => identity.id) });
    }
  }

  // Créneaux → identités, équipes.
  const identityOfEntry = (entry: Entry) => identities.get(identityKeyOf.get(`${entry.buyerId}::${strictNameKey(entry.raw)}`)!)!;
  const plannedTeams: PlannedTeam[] = [];
  const slotPlans: MigrationPlan["slots"] = [];
  for (const slot of legacySlots) {
    const entries = entriesBySlot.get(slot.id) ?? [];
    if (entries.length === 0) continue;
    const memberIds = entries.map(entry => identityOfEntry(entry).id);
    const categoryId = slot.data().categoryId;
    const required = getParticipantsPerSlot(categories.get(categoryId));
    let teamId: string | null = null;
    if (required > 1) {
      teamId = `mig_t_${slot.id}`;
      const memberKeys = entries.map(entry => strictNameKey(identityOfEntry(entry).name)).sort().join("+");
      const reference = teamReferences.find(candidate => candidate.names.map(strictNameKey).sort().join("+") === memberKeys);
      // Document plus complet pour le même numéro (ex. résultats officiels donnant l'équipier manquant).
      const completion = reference
        ? teamReferences.find(candidate => candidate.bib === reference.bib && candidate.names.length > entries.length)
        : undefined;
      const overlapping = teamReferences.filter(candidate =>
        candidate.names.some(name => entries.some(entry => strictNameKey(identityOfEntry(entry).name) === strictNameKey(name)))
      );
      const displayOverride = reference ? (decisions.teamDisplayNames ?? []).find(entry => entry.bib === reference.bib) : undefined;
      const team: PlannedTeam = {
        id: teamId,
        slotId: slot.id,
        categoryId,
        memberIds,
        requiredMembers: required,
        status: memberIds.length >= required ? "complete" : "incomplete",
        bib: reference?.bib ?? null,
        bibSource: reference?.source ?? null,
        displayName: displayOverride?.displayName ?? null,
      };
      plannedTeams.push(team);
      const label = entries.map(entry => displayName(identityOfEntry(entry).name)).join(" – ");
      if (team.status === "incomplete") {
        issues.push({
          kind: "team_incomplete",
          message: `Équipe ${label} : ${memberIds.length}/${required} membre(s) connus.` +
            (completion ? ` ${completion.source} indique « ${completion.names.map(displayName).join(" – ")} » : à compléter dans le dashboard après vérification.` : " À compléter dans le dashboard sur document officiel."),
          refs: [slot.id, ...(completion ? [completion.source] : [])],
        });
      }
      if (!reference) {
        issues.push({
          kind: "team_unmatched",
          message: `Équipe ${label} : aucun dossard d'équipe ne correspond exactement à ses membres${overlapping.length ? ` (proches : ${overlapping.map(candidate => `n° ${candidate.bib} ${candidate.names.map(displayName).join(" – ")}`).join(" ; ")})` : ""}.`,
          refs: [slot.id],
        });
      }
    }
    slotPlans.push({ slotId: slot.id, participantIds: memberIds, teamId });
  }

  for (const identity of identities.values()) {
    if (identity.bib === null && !identity.withdrawn) {
      issues.push({ kind: "bib_not_found", message: `${displayName(identity.name)} : aucun dossard individuel dans les documents de référence.`, refs: [identity.id] });
    }
  }

  // Places repas des paiements historiques.
  const seatPayments = new Set(seatsSnapshot.docs.map(doc => doc.data().paymentId));
  const payments: PaymentView[] = paymentsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId ?? "",
      stripeSessionId: data.stripeSessionId ?? null,
      status: data.status ?? "paid",
      amount: Number(data.amount ?? 0),
      createdAt: data.createdAt?.toDate?.() ?? null,
      isPack: !!data.isPack,
      metadata: data.metadata ?? {},
      mealSeatIds: data.mealSeatIds ?? [],
    };
  });
  const { kept, duplicates } = canonicalPayments(payments);
  duplicates.forEach(duplicate =>
    issues.push({
      kind: "duplicate_payment_record",
      message: `Paiement ${duplicate.id} : même session Stripe qu'un autre enregistrement (${duplicate.stripeSessionId}). Compté une fois, non supprimé.`,
      refs: [duplicate.id, duplicate.stripeSessionId ?? ""],
    })
  );
  const mealSeats = kept
    .filter(payment => !seatPayments.has(payment.id))
    .map(payment => ({ payment, seats: derivedSeats(payment) }))
    .filter(entry => entry.seats.length > 0)
    .map(({ payment, seats }) => {
      const named = seats.filter(seat => seat.beneficiary).length;
      if (named < seats.length) {
        issues.push({ kind: "meal_names_missing", message: `Commande ${payment.stripeSessionId ?? payment.id} : ${seats.length - named} place(s) repas sans nom.`, refs: [payment.id] });
      }
      return { paymentId: payment.id, seats: seats.length, named };
    });

  const participants = [...identities.values()].sort((a, b) => a.id.localeCompare(b.id));
  const plan: Omit<MigrationPlan, "fingerprint"> = {
    eventId,
    participants,
    teams: plannedTeams,
    slots: slotPlans,
    mealSeats,
    issues,
    stats: {
      legacySlots: legacySlots.length,
      existingParticipants: existingParticipants.size,
      participants: participants.length,
      withBib: participants.filter(identity => identity.bib !== null).length,
      renamed: participants.filter(identity => identity.renamedBy).length,
      withdrawn: participants.filter(identity => identity.withdrawn).length,
      teams: plannedTeams.length,
      incompleteTeams: plannedTeams.filter(team => team.status === "incomplete").length,
      mealSeats: mealSeats.reduce((sum, entry) => sum + entry.seats, 0),
      issues: issues.length,
    },
  };
  return { ...plan, fingerprint: hash(JSON.stringify(plan)) };
}

export async function applyIdentityMigration(
  db: Firestore,
  eventId: string,
  options: { references?: BibReference[]; decisions?: MigrationDecisions; fingerprint: string; actor: { uid: string; displayName: string } }
): Promise<{ applied: boolean; writes: number; plan: MigrationPlan }> {
  const plan = await planIdentityMigration(db, eventId, options);
  if (plan.fingerprint !== options.fingerprint) {
    throw new Error(`Empreinte différente (${plan.fingerprint} ≠ ${options.fingerprint}) : la base a changé depuis la simulation. Relancez la simulation et relisez le rapport.`);
  }
  const at = Timestamp.now();
  const operations: Array<(batch: WriteBatch) => void> = [];

  for (const participant of plan.participants) {
    const ref = db.collection("participants").doc(participant.id);
    operations.push(batch =>
      batch.set(ref, {
        eventId,
        ...participant.name,
        enteredAs: participant.enteredAs,
        nameKey: strictNameKey(participant.name),
        looseNameKey: looseNameKey(participant.name),
        ...(participant.shirtSize ? { shirtSize: participant.shirtSize } : {}),
        bib: participant.bib,
        buyerIds: participant.buyerIds,
        createdFrom: "migration",
        sourcePaymentId: null,
        withdrawn: participant.withdrawn,
        version: 1,
        createdAt: at,
        updatedAt: at,
        updatedBy: options.actor.uid,
      }, { merge: false })
    );
    if (participant.bib !== null) {
      operations.push(batch =>
        batch.set(db.collection("bibs").doc(`${eventId}_${participant.bib}`), { eventId, bib: participant.bib, holderType: "participant", holderId: participant.id, assignedAt: at, assignedBy: options.actor.uid, source: participant.bibSource })
      );
    }
    if (participant.renamedBy) {
      operations.push(batch =>
        batch.set(db.collection("auditLogs").doc(`mig_rename_${participant.id}`), {
          eventId, entity: "participant", entityId: participant.id, action: "participant.rename",
          actorUid: options.actor.uid, actorName: options.actor.displayName,
          before: participant.enteredAs, after: participant.name, reason: `Migration — ${participant.renamedBy}`, at,
        })
      );
    }
  }
  for (const team of plan.teams) {
    operations.push(batch =>
      batch.set(db.collection("teams").doc(team.id), {
        eventId, categoryId: team.categoryId, slotId: team.slotId, memberIds: team.memberIds, requiredMembers: team.requiredMembers,
        status: team.status, bib: team.bib, displayName: team.displayName, buyerId: null, createdFrom: "migration",
        sourcePaymentId: null, version: 1, createdAt: at, updatedAt: at,
      })
    );
    if (team.bib !== null) {
      operations.push(batch =>
        batch.set(db.collection("bibs").doc(`${eventId}_${team.bib}`), { eventId, bib: team.bib, holderType: "team", holderId: team.id, assignedAt: at, assignedBy: options.actor.uid, source: team.bibSource })
      );
    }
  }
  const byId = new Map(plan.participants.map(participant => [participant.id, participant]));
  for (const slot of plan.slots) {
    operations.push(batch =>
      batch.update(db.collection("slots").doc(slot.slotId), {
        participantIds: slot.participantIds,
        teamId: slot.teamId,
        // Copies d'affichage alignées sur les identités (noms corrigés compris).
        participants: slot.participantIds.map(id => ({ ...byId.get(id)!.name, ...(byId.get(id)!.shirtSize ? { shirtSize: byId.get(id)!.shirtSize } : {}) })),
        participant: { ...byId.get(slot.participantIds[0])!.name },
      })
    );
  }
  const paymentDocs = plan.mealSeats.length
    ? await db.getAll(...plan.mealSeats.map(entry => db.collection("payments").doc(entry.paymentId)))
    : [];
  for (const paymentDoc of paymentDocs) {
    const data = paymentDoc.data()!;
    const seats = derivedSeats({
      id: paymentDoc.id, userId: data.userId ?? "", stripeSessionId: data.stripeSessionId ?? null, status: data.status ?? "paid",
      amount: Number(data.amount ?? 0), createdAt: null, isPack: !!data.isPack, metadata: data.metadata ?? {},
    });
    seats.forEach((seat, index) =>
      operations.push(batch =>
        batch.set(db.collection("mealSeats").doc(`${paymentDoc.id}_m${index + 1}`), {
          eventId, paymentId: paymentDoc.id, stripeSessionId: seat.stripeSessionId, buyerId: seat.buyerId, seatIndex: seat.seatIndex,
          seatsInOrder: seat.seatsInOrder, beneficiary: seat.beneficiary ? canonicalName(seat.beneficiary) : null, beneficiaryParticipantId: null,
          mealLabel: null, unitPrice: seat.unitPrice, includedInPack: seat.includedInPack, source: "migration",
          financialStatus: seat.financialStatus, attendance: { present: false }, createdAt: at, updatedAt: at,
        })
      )
    );
  }
  operations.push(batch =>
    batch.set(db.collection("migrations").doc(`identities_${eventId}_${plan.fingerprint}`), {
      eventId, kind: "identities", fingerprint: plan.fingerprint, stats: plan.stats, appliedAt: at, appliedBy: options.actor.uid,
    })
  );

  // Lots de 400 écritures (limite Firestore : 500).
  for (let index = 0; index < operations.length; index += 400) {
    const batch = db.batch();
    operations.slice(index, index + 400).forEach(operation => operation(batch));
    await batch.commit();
  }
  return { applied: true, writes: operations.length, plan };
}
