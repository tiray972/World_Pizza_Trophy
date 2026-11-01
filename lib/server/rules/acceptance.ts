// lib/server/rules/acceptance.ts
// Contrôle serveur des acceptations de règlement au moment du paiement.
// L'état d'un composant ne prouve rien : seule compte la version publiée en
// base au moment de la commande.

import type { Firestore, Transaction } from "firebase-admin/firestore";
import { isAcceptanceValid, type PublishedRules } from "@/lib/domain/category-rules";

export interface ClientRuleAcceptance {
  categoryId: string;
  ruleVersionId: string;
  version: number;
  requestedLang: string;
  displayedLang: string;
  /** Moment de l'acceptation dans le navigateur (ISO). */
  acceptedAt: string;
}

export type MissingRuleReason = "not_published" | "not_accepted" | "outdated_version";

export interface RuleAcceptanceCheck {
  accepted: ClientRuleAcceptance[];
  missing: Array<{ categoryId: string; reason: MissingRuleReason; currentVersion: number | null }>;
}

/**
 * Exigence par édition (`events.rulesAcceptanceRequired`) : jamais appliquée
 * rétroactivement aux éditions qui ne l'ont pas activée, mais les acceptations
 * valables transmises sont toujours enregistrées.
 */
export async function verifyRuleAcceptances(
  tx: Transaction,
  db: Firestore,
  input: {
    event: { id: string; rulesAcceptanceRequired: boolean };
    categoryIds: string[];
    acceptances: ClientRuleAcceptance[];
  }
): Promise<RuleAcceptanceCheck> {
  const snapshots = await Promise.all(input.categoryIds.map(id => tx.get(db.collection("categories").doc(id))));
  const result: RuleAcceptanceCheck = { accepted: [], missing: [] };

  snapshots.forEach(snapshot => {
    const published = (snapshot.data()?.rulesI18n?.published ?? null) as PublishedRules | null;
    const acceptance = input.acceptances.find(entry => entry.categoryId === snapshot.id);
    const acceptedAt = acceptance ? new Date(acceptance.acceptedAt) : null;
    const valid =
      isAcceptanceValid(published, acceptance) && !!acceptedAt && !Number.isNaN(acceptedAt.getTime());

    if (valid) {
      result.accepted.push({
        categoryId: snapshot.id,
        ruleVersionId: acceptance!.ruleVersionId,
        version: acceptance!.version,
        requestedLang: acceptance!.requestedLang,
        displayedLang: acceptance!.displayedLang,
        acceptedAt: acceptedAt!.toISOString(),
      });
      return;
    }
    if (!input.event.rulesAcceptanceRequired) return;
    result.missing.push({
      categoryId: snapshot.id,
      reason: !published?.version ? "not_published" : acceptance ? "outdated_version" : "not_accepted",
      currentVersion: published?.version ?? null,
    });
  });

  return result;
}
