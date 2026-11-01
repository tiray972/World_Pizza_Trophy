"use client";

// Règlement d'une catégorie : brouillon en 4 langues, aperçu, traductions
// manquantes, publication d'une version. Le Booking n'affiche que la version
// publiée ; un brouillon inachevé n'est jamais montré aux candidats.

import React, { useMemo, useState } from "react";
import { Button } from "./ui/Button";
import { adminFetch } from "../lib/adminFetch";
import {
  draftFromDictionaryEntry,
  missingLangs,
  parseRuleText,
  RULE_LANGS,
  RULES_REFERENCE_LANG,
  type RuleLang,
  type RuleTexts,
} from "@/lib/domain/category-rules";
import { toDateOrNull } from "@/lib/domain/event-lifecycle";
import { ruleSlugForCategoryName } from "@/lib/i18n/category-rule-slugs";
import { dictionaries } from "@/lib/i18n/config";
import type { Category } from "@/types/firestore";

const LANG_LABELS: Record<RuleLang, string> = { fr: "Français (référence)", en: "English", es: "Español", it: "Italiano" };

export function RulesEditorModal({ category, onClose }: { category: Category; onClose: () => void }) {
  const published = category.rulesI18n?.published ?? null;
  const [texts, setTexts] = useState<RuleTexts>(() => ({ ...(category.rulesI18n?.draft?.texts ?? published?.texts ?? {}) }));
  const [names, setNames] = useState<Record<string, string>>(() => ({ ...(category.nameI18n ?? {}) }));
  const [lang, setLang] = useState<RuleLang>("fr");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const missing = missingLangs(texts);
  const changedSincePublished = useMemo(
    () => JSON.stringify(texts) !== JSON.stringify(published?.texts ?? {}),
    [texts, published]
  );
  const slug = ruleSlugForCategoryName(category.name);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: "ok", text: success });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = () =>
    adminFetch(`/api/admin/categories/${category.id}/rules`, { method: "PUT", body: { texts, nameI18n: names } });

  const prefillFromSite = () => {
    if (!slug) return;
    const next: RuleTexts = { ...texts };
    for (const code of RULE_LANGS) {
      const dictionary = dictionaries[code] as unknown as {
        rulesDetail?: { categoryRules?: Record<string, { description?: string; rules?: string[]; specs?: Record<string, unknown> }>; specsTable?: Record<string, string> };
      };
      const entry = dictionary.rulesDetail?.categoryRules?.[slug];
      const labels = dictionary.rulesDetail?.specsTable;
      if (entry && !next[code]?.trim()) {
        next[code] = draftFromDictionaryEntry(entry, { duration: labels?.duration, format: labels?.format, oven: labels?.oven });
      }
    }
    setTexts(next);
    setMessage({ kind: "ok", text: "Brouillon prérempli avec le règlement actuel du site. Relisez-le avant publication." });
  };

  const publishedAt = toDateOrNull(published?.publishedAt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Règlement — ${category.name}`}>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 grid max-h-[92vh] w-full max-w-3xl gap-4 overflow-y-auto rounded-lg border bg-card p-6 shadow-lg">
        <div>
          <h2 className="text-lg font-semibold">Règlement — {category.name}</h2>
          <p className="text-sm text-muted-foreground">
            {published
              ? `Version publiée : ${published.version}${publishedAt ? `, le ${publishedAt.toLocaleString("fr-FR")}` : ""}${published.publishedByName ? ` par ${published.publishedByName}` : ""}. Langues : ${Object.keys(published.texts).join(", ")}.`
              : "Aucune version publiée : la catégorie n'est pas réservable si l'édition exige l'acceptation du règlement."}
          </p>
          {changedSincePublished && <p className="mt-1 text-sm font-medium text-amber-700">Brouillon différent de la version publiée : les candidats voient toujours la version publiée.</p>}
        </div>

        <fieldset className="grid gap-2 sm:grid-cols-4">
          <legend className="mb-1 text-sm font-medium">Nom de la catégorie par langue (vide = nom actuel « {category.name} »)</legend>
          {RULE_LANGS.map(code => (
            <input
              key={code}
              className="h-9 rounded-md border bg-background px-2 text-sm"
              aria-label={`Nom en ${code}`}
              placeholder={`${code} : ${category.name}`}
              value={names[code] ?? ""}
              onChange={event => setNames(previous => ({ ...previous, [code]: event.target.value }))}
            />
          ))}
        </fieldset>

        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Langue du règlement">
          {RULE_LANGS.map(code => (
            <Button key={code} size="sm" role="tab" aria-selected={lang === code} variant={lang === code ? "default" : "outline"} onClick={() => setLang(code)}>
              {code.toUpperCase()}
              {missing.includes(code) && <span className="ml-1 text-xs text-red-600" aria-label="traduction manquante">●</span>}
            </Button>
          ))}
          <span className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => setPreview(value => !value)}>{preview ? "Modifier" : "Aperçu"}</Button>
          {slug && <Button size="sm" variant="outline" onClick={prefillFromSite}>Préremplir depuis le site</Button>}
        </div>

        {missing.length > 0 && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            Traductions manquantes : {missing.map(code => code.toUpperCase()).join(", ")}.
            {missing.includes(RULES_REFERENCE_LANG)
              ? " Le français (référence) est obligatoire pour publier."
              : " Le Booking affichera le texte français dans ces langues, en le signalant au candidat."}
          </p>
        )}

        <label className="grid gap-1 text-sm font-medium">
          {LANG_LABELS[lang]}
          {preview ? (
            <div lang={lang} className="min-h-64 space-y-3 rounded-md border bg-background p-4 text-sm font-normal leading-6">
              {(texts[lang] ?? "").trim() ? (
                parseRuleText(texts[lang] ?? "").map((block, index) =>
                  block.kind === "heading" ? <h3 key={index} className="font-semibold">{block.text}</h3>
                    : block.kind === "list" ? <ul key={index} className="list-disc pl-5">{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
                    : <p key={index}>{block.text}</p>
                )
              ) : (
                <p className="italic text-muted-foreground">Texte vide.</p>
              )}
            </div>
          ) : (
            <textarea
              className="min-h-64 w-full rounded-md border bg-background p-3 font-mono text-sm font-normal"
              value={texts[lang] ?? ""}
              onChange={event => setTexts(previous => ({ ...previous, [lang]: event.target.value }))}
              placeholder={"## Intertitre\n- Point du règlement\n\nParagraphe…"}
            />
          )}
          <span className="text-xs font-normal text-muted-foreground">Format : « ## » intertitre, « - » liste, ligne vide = paragraphe. Aucun HTML n&apos;est interprété.</span>
        </label>

        {message && <p className={`text-sm ${message.kind === "ok" ? "text-green-700" : "text-red-700"}`} role="status">{message.text}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button variant="secondary" disabled={busy} onClick={() => run(saveDraft, "Brouillon enregistré (non visible des candidats).")}>Enregistrer le brouillon</Button>
          <Button
            disabled={busy || missing.includes(RULES_REFERENCE_LANG)}
            onClick={() => {
              const next = (published?.version ?? 0) + 1;
              if (!window.confirm(`Publier la version ${next} ? Les nouvelles réservations devront l'accepter ; les acceptations passées restent liées à leur version.`)) return;
              run(async () => {
                await saveDraft();
                await adminFetch(`/api/admin/categories/${category.id}/rules`, { body: { expectedPublishedVersion: published?.version ?? 0 } });
              }, `Version ${next} publiée.`);
            }}
          >
            Publier la version {(published?.version ?? 0) + 1}
          </Button>
        </div>
      </div>
    </div>
  );
}
