// lib/domain/category-rules.ts
// Règlement d'une catégorie : brouillon modifiable, versions publiées
// immuables, quatre langues. Source de vérité : le document de la catégorie
// (`rulesI18n`) et la collection `ruleVersions`.
//
// Repli linguistique : si la langue du Booking manque dans la version publiée,
// le texte de la langue de référence (français) est proposé EN LE SIGNALANT, et
// c'est cette langue qui est enregistrée avec l'acceptation. Sans texte de
// référence, la catégorie n'est pas réservable : rien n'est accepté à vide.

export const RULE_LANGS = ["fr", "en", "es", "it"] as const;
export type RuleLang = (typeof RULE_LANGS)[number];
export const RULES_REFERENCE_LANG: RuleLang = "fr";

export type RuleTexts = Partial<Record<RuleLang, string>>;

export interface PublishedRules {
  version: number;
  versionId: string;
  texts: RuleTexts;
  referenceLang: RuleLang;
  publishedAt: Date;
  publishedBy: string;
  publishedByName?: string;
}

export interface CategoryRulesState {
  draft?: { texts: RuleTexts; updatedAt?: Date; updatedBy?: string };
  published?: PublishedRules | null;
}

export function isRuleLang(value: string | null | undefined): value is RuleLang {
  return !!value && (RULE_LANGS as readonly string[]).includes(value);
}

export function hasText(texts: RuleTexts | undefined, lang: RuleLang): boolean {
  return !!texts?.[lang]?.trim();
}

export function missingLangs(texts: RuleTexts | undefined): RuleLang[] {
  return RULE_LANGS.filter(lang => !hasText(texts, lang));
}

export function ruleVersionId(categoryId: string, version: number): string {
  return `${categoryId}_v${version}`;
}

export type RulesResolution =
  | { status: "ok"; text: string; displayedLang: RuleLang; isFallback: boolean; version: number; versionId: string }
  | { status: "not_published" }
  | { status: "no_text" };

/** Texte à présenter pour une langue donnée, avec repli explicite. */
export function resolveRulesForLang(
  published: Pick<PublishedRules, "texts" | "referenceLang" | "version" | "versionId"> | null | undefined,
  requestedLang: string
): RulesResolution {
  if (!published || !published.version) return { status: "not_published" };
  const lang: RuleLang = isRuleLang(requestedLang) ? requestedLang : RULES_REFERENCE_LANG;
  if (hasText(published.texts, lang)) {
    return { status: "ok", text: published.texts[lang]!, displayedLang: lang, isFallback: false, version: published.version, versionId: published.versionId };
  }
  const reference = published.referenceLang || RULES_REFERENCE_LANG;
  if (hasText(published.texts, reference)) {
    return { status: "ok", text: published.texts[reference]!, displayedLang: reference, isFallback: true, version: published.version, versionId: published.versionId };
  }
  return { status: "no_text" };
}

/** Une acceptation est-elle valable pour la version publiée actuelle ? */
export function isAcceptanceValid(
  published: Pick<PublishedRules, "texts" | "referenceLang" | "version" | "versionId"> | null | undefined,
  acceptance: { version: number; ruleVersionId: string; requestedLang: string; displayedLang: string } | undefined
): boolean {
  if (!published || !acceptance) return false;
  if (acceptance.version !== published.version || acceptance.ruleVersionId !== published.versionId) return false;
  const resolution = resolveRulesForLang(published, acceptance.requestedLang);
  return resolution.status === "ok" && resolution.displayedLang === acceptance.displayedLang;
}

/* ───────────── Format du texte : sous-ensemble sûr, jamais de HTML ─────────────
   - ligne « ## Titre » : intertitre
   - ligne « - élément » ou « • élément » : liste à puces
   - ligne vide : nouveau paragraphe
   Le rendu produit des nœuds texte (React échappe tout) : pas d'injection possible. */

export type RuleBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

export function parseRuleText(text: string): RuleBlock[] {
  const blocks: RuleBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ kind: "list", items: list });
    list = [];
  };
  for (const rawLine of (text || "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
    } else if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", text: line.slice(3).trim() });
    } else if (/^[-•]\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^[-•]\s+/, ""));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Brouillon initial à partir du règlement statique du site (dictionnaires). */
export function draftFromDictionaryEntry(entry: {
  description?: string;
  rules?: string[];
  specs?: Record<string, unknown>;
}, labels?: { duration?: string; format?: string; oven?: string }): string {
  const lines: string[] = [];
  if (entry.description) lines.push(entry.description, "");
  for (const rule of entry.rules ?? []) lines.push(`- ${rule}`);
  const specs = entry.specs ?? {};
  const specLines = [
    specs.duration ? `- ${labels?.duration ?? "Durée"} : ${specs.duration}` : null,
    specs.format ? `- ${labels?.format ?? "Format"} : ${specs.format}` : null,
    specs.oven ? `- ${labels?.oven ?? "Four"} : ${specs.oven}` : null,
  ].filter(Boolean) as string[];
  if (specLines.length) lines.push("", ...specLines);
  return lines.join("\n").trim();
}
