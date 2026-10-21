// lib/booking/packs.ts
// Règles des packs partagées entre le dashboard, la page de réservation et le
// serveur de paiement (source de vérité).

import type { Product } from "@/types/firestore";

/** Nombre maximum d'exemplaires d'un même pack dans une commande. */
export const MAX_PACK_QUANTITY = 10;

/** Repas inclus dans UN pack (rétrocompatible avec l'ancien booléen). */
export function packMealsIncluded(
  product?: Pick<Product, "mealsIncluded" | "includesMeal"> | null
): number {
  const value = Number(product?.mealsIncluded);
  if (Number.isFinite(value) && value >= 0) return Math.floor(value);
  return product?.includesMeal ? 1 : 0;
}

/** Une catégorie peut-elle être choisie dans ce pack ? */
export function packAllowsCategory(
  product: Pick<Product, "excludedCategoryIds"> | null | undefined,
  categoryId: string
): boolean {
  return !(product?.excludedCategoryIds ?? []).includes(categoryId);
}

export function clampPackQuantity(value: unknown): number {
  const quantity = Math.floor(Number(value));
  if (!Number.isFinite(quantity) || quantity < 1) return 1;
  return Math.min(quantity, MAX_PACK_QUANTITY);
}

/** Libellé de repli pour un repas inclus dont le nom n'a pas été donné. */
export const UNNAMED_PACK_MEAL = { firstName: "Repas inclus", lastName: "(nom à préciser)" };
