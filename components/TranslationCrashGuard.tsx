"use client";

import { useEffect } from "react";

/**
 * Filet de sécurité contre les plantages provoqués par la traduction
 * automatique du navigateur (Chrome, Edge, extensions de traduction).
 *
 * Ces outils remplacent les nœuds de texte de la page par les leurs. React,
 * qui garde une référence vers les nœuds d'origine, échoue ensuite sur
 * removeChild / insertBefore ("NotFoundError: The node to be removed is not a
 * child of this node") et l'application entière s'arrête : page blanche.
 *
 * `translate="no"` empêche déjà la traduction dans les navigateurs qui le
 * respectent. Ce garde-fou couvre les autres : quand le nœud visé n'appartient
 * plus au parent, on ignore l'opération au lieu de laisser l'exception tuer la
 * page. Le reste du rendu continue normalement.
 */
export function TranslationCrashGuard() {
  useEffect(() => {
    if (typeof Node !== "function" || !Node.prototype) return;

    const guardedNode = Node.prototype as unknown as { __wptTranslationGuard?: boolean };
    if (guardedNode.__wptTranslationGuard) return;
    guardedNode.__wptTranslationGuard = true;

    const originalRemoveChild = Node.prototype.removeChild;
    const originalInsertBefore = Node.prototype.insertBefore;

    Node.prototype.removeChild = function <T extends Node>(child: T): T {
      if (child.parentNode !== this) {
        // Nœud déjà remplacé par le traducteur : on n'a rien à retirer.
        console.warn("⚠️ [TranslationGuard] removeChild ignoré (nœud déplacé par une traduction)");
        return child;
      }
      return originalRemoveChild.call(this, child) as T;
    };

    Node.prototype.insertBefore = function <T extends Node>(
      newNode: T,
      referenceNode: Node | null
    ): T {
      if (referenceNode && referenceNode.parentNode !== this) {
        console.warn("⚠️ [TranslationGuard] insertBefore replacé en fin de parent (traduction)");
        return originalInsertBefore.call(this, newNode, null) as T;
      }
      return originalInsertBefore.call(this, newNode, referenceNode) as T;
    };

    return () => {
      Node.prototype.removeChild = originalRemoveChild;
      Node.prototype.insertBefore = originalInsertBefore;
      guardedNode.__wptTranslationGuard = false;
    };
  }, []);

  return null;
}
