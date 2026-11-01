'use client';

// Fenêtre « Règlement — catégorie » affichée avant le choix des créneaux.
// Fermer, cliquer à l'extérieur ou appuyer sur Échap n'accepte jamais : seule la
// case cochée puis le bouton « Accepter » transmettent une acceptation.

import { useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { parseRuleText, resolveRulesForLang, type PublishedRules } from '@/lib/domain/category-rules';
import { toDateOrNull } from '@/lib/domain/event-lifecycle';
import { fill, rulesDialogTexts } from '@/lib/i18n/rules-dialog-texts';
import type { ClientRuleAcceptance } from '@/lib/server/rules/acceptance';

interface CategoryRulesDialogProps {
  open: boolean;
  lang: string;
  categoryId: string;
  categoryName: string;
  isTeamCategory: boolean;
  published: PublishedRules | null | undefined;
  onAccept: (acceptance: ClientRuleAcceptance) => void;
  onCancel: () => void;
}

const DATE_LOCALES: Record<string, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT' };

export function CategoryRulesDialog({
  open,
  lang,
  categoryId,
  categoryName,
  isTeamCategory,
  published,
  onAccept,
  onCancel,
}: CategoryRulesDialogProps) {
  const t = rulesDialogTexts(lang);
  const checkboxId = useId();
  // Case jamais précochée : le parent remonte la fenêtre (clé) à chaque ouverture.
  const [checked, setChecked] = useState(false);

  const resolution = resolveRulesForLang(published, lang);
  const publishedAt = toDateOrNull(published?.publishedAt);
  const langName = (code: string) => (t.langs as Record<string, string>)[code] ?? code;

  const handleAccept = () => {
    if (!checked || resolution.status !== 'ok') return;
    onAccept({
      categoryId,
      ruleVersionId: resolution.versionId,
      version: resolution.version,
      requestedLang: lang,
      displayedLang: resolution.displayedLang,
      acceptedAt: new Date().toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onCancel(); }}>
      <DialogContent
        className="flex max-h-[min(90dvh,48rem)] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 p-0"
        aria-describedby={`${checkboxId}-intro`}
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 border-b px-5 pb-4 pt-5 pr-12 text-left sm:px-6">
          <DialogTitle className="text-xl leading-snug">{fill(t.title, { category: categoryName })}</DialogTitle>
          <DialogDescription id={`${checkboxId}-intro`}>{t.intro}</DialogDescription>
          {resolution.status === 'ok' && publishedAt && (
            <p className="text-xs text-muted-foreground">
              {fill(t.version, {
                version: resolution.version,
                date: publishedAt.toLocaleDateString(DATE_LOCALES[lang] ?? 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
              })}
            </p>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6" tabIndex={0} aria-label={fill(t.title, { category: categoryName })}>
          {resolution.status === 'ok' ? (
            <>
              {resolution.isFallback && (
                <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">
                  {fill(t.fallback, { requested: langName(lang), displayed: langName(resolution.displayedLang) })}
                </p>
              )}
              <div lang={resolution.displayedLang} className="space-y-3 text-sm leading-6 text-gray-800">
                {parseRuleText(resolution.text).map((block, index) =>
                  block.kind === 'heading' ? (
                    <h3 key={index} className="pt-2 text-base font-semibold text-gray-950">{block.text}</h3>
                  ) : block.kind === 'list' ? (
                    <ul key={index} className="list-disc space-y-1 pl-5">
                      {block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
                    </ul>
                  ) : (
                    <p key={index}>{block.text}</p>
                  )
                )}
              </div>
              <p className="mt-5 rounded-md bg-gray-50 p-3 text-xs leading-5 text-gray-600">
                {t.actorNotice}
                {isTeamCategory && <span className="mt-1 block font-medium">{t.teamNotice}</span>}
              </p>
            </>
          ) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-gray-700" role="status">{t.notPublished}</p>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-3 border-t px-5 py-4 sm:flex-col sm:px-6">
          {resolution.status === 'ok' && (
            <label htmlFor={checkboxId} className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-medium">
              <input
                id={checkboxId}
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-primary"
                checked={checked}
                onChange={event => setChecked(event.target.checked)}
              />
              <span>{t.checkbox}</span>
            </label>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>
              {t.cancel}
            </Button>
            {resolution.status === 'ok' && (
              <Button type="button" className="min-h-11" disabled={!checked} onClick={handleAccept}>
                {t.accept}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
