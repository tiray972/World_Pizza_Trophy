// lib/server/rules/publish.ts
// Brouillon et publication du règlement d'une catégorie. Une version publiée
// est immuable (`ruleVersions`) : les acceptations passées restent rattachées
// au texte exact présenté. Modifier le brouillon n'affecte pas le Booking.

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { hasText, RULE_LANGS, RULES_REFERENCE_LANG, ruleVersionId, type RuleTexts } from "@/lib/domain/category-rules";
import { normalizeSpaces } from "@/lib/domain/names";
import { ParticipantActionError, type ActionContext } from "@/lib/server/participants/service";

const MAX_TEXT_LENGTH = 30000;

function cleanTexts(texts: Record<string, unknown> | undefined): RuleTexts {
  const cleaned: RuleTexts = {};
  for (const lang of RULE_LANGS) {
    const value = typeof texts?.[lang] === "string" ? (texts[lang] as string).replace(/\r\n?/g, "\n").trim() : "";
    if (value.length > MAX_TEXT_LENGTH) {
      throw new ParticipantActionError(400, `Texte trop long (${lang}).`, "text_too_long");
    }
    if (value) cleaned[lang] = value;
  }
  return cleaned;
}

export async function saveRulesDraft(
  db: Firestore,
  input: { categoryId: string; texts: Record<string, unknown>; nameI18n?: Record<string, unknown> },
  context: ActionContext
) {
  const at = Timestamp.fromDate(context.now ?? new Date());
  const ref = db.collection("categories").doc(input.categoryId);
  const texts = cleanTexts(input.texts);
  const nameI18n = Object.fromEntries(
    RULE_LANGS.map(lang => [lang, normalizeSpaces(typeof input.nameI18n?.[lang] === "string" ? (input.nameI18n[lang] as string) : "")]).filter(([, value]) => value)
  );
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new ParticipantActionError(404, "Catégorie introuvable.", "not_found");
    tx.update(ref, {
      "rulesI18n.draft": { texts, updatedAt: at, updatedBy: context.actor.uid, updatedByName: context.actor.displayName },
      nameI18n,
    });
    return { ok: true };
  });
}

export async function publishRules(
  db: Firestore,
  input: { categoryId: string; expectedPublishedVersion: number },
  context: ActionContext
) {
  const at = Timestamp.fromDate(context.now ?? new Date());
  const ref = db.collection("categories").doc(input.categoryId);
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new ParticipantActionError(404, "Catégorie introuvable.", "not_found");
    const data = snapshot.data()!;
    const current = data.rulesI18n?.published?.version ?? 0;
    if (current !== input.expectedPublishedVersion) {
      throw new ParticipantActionError(409, "Une autre version a été publiée entre-temps. Rechargez avant de publier.", "version_conflict", { currentVersion: current });
    }
    const texts = cleanTexts(data.rulesI18n?.draft?.texts);
    if (!hasText(texts, RULES_REFERENCE_LANG)) {
      throw new ParticipantActionError(400, "Le texte de référence (français) est obligatoire pour publier.", "reference_text_required");
    }
    const version = current + 1;
    const versionId = ruleVersionId(ref.id, version);
    const published = {
      version,
      versionId,
      texts,
      referenceLang: RULES_REFERENCE_LANG,
      publishedAt: at,
      publishedBy: context.actor.uid,
      publishedByName: context.actor.displayName,
    };
    tx.create(db.collection("ruleVersions").doc(versionId), {
      ...published,
      eventId: data.eventId,
      categoryId: ref.id,
      categoryName: data.name ?? "",
      categoryNameI18n: data.nameI18n ?? {},
    });
    tx.update(ref, { "rulesI18n.published": published });
    tx.set(db.collection("auditLogs").doc(), {
      eventId: data.eventId,
      entity: "category",
      entityId: ref.id,
      action: "rules.publish",
      actorUid: context.actor.uid,
      actorName: context.actor.displayName,
      before: { version: current },
      after: { version, langs: Object.keys(texts) },
      reason: context.reason ?? null,
      at,
    });
    return { version, versionId };
  });
}
