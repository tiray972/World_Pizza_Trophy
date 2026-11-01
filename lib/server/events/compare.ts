// lib/server/events/compare.ts
// Diagnostic comparatif de deux éditions (ex. 2027 face à 2026) et réparation
// sélective, prévisualisée et tracée. Ne recrée jamais une édition, n'écrase
// ni prix, ni règlement, ni inscription de l'édition cible.

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { ParticipantActionError, type ActionContext } from "@/lib/server/participants/service";

const key = (name: unknown) => String(name ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export interface EditionComparison {
  source: { id: string; name: string };
  target: { id: string; name: string; status: string; payments: number; bookedSlots: number; slots: number };
  event: string[];
  categories: Array<{ name: string; status: "same" | "different" | "missing_in_target" | "only_in_target"; sourceId?: string; targetId?: string; differences: string[] }>;
  products: Array<{ name: string; status: "same" | "different" | "missing_in_target" | "only_in_target"; targetId?: string; differences: string[]; linksToOtherEdition: string[]; unknownLinks: string[] }>;
  checklist: Array<{ item: string; ok: boolean; detail: string }>;
}

export async function compareEditions(db: Firestore, sourceId: string, targetId: string): Promise<EditionComparison> {
  const [source, target] = await Promise.all([db.collection("events").doc(sourceId).get(), db.collection("events").doc(targetId).get()]);
  if (!source.exists || !target.exists) throw new ParticipantActionError(404, "Édition introuvable.", "not_found");
  const load = (collection: string, eventId: string) => db.collection(collection).where("eventId", "==", eventId).get();
  const [sourceCategories, targetCategories, sourceProducts, targetProducts, targetSlots, targetPayments] = await Promise.all([
    load("categories", sourceId), load("categories", targetId), load("products", sourceId), load("products", targetId), load("slots", targetId), load("payments", targetId),
  ]);

  const sourceData = source.data()!;
  const targetData = target.data()!;
  const event: string[] = [];
  for (const field of ["mealPrice", "minSlotsPerBooking", "rulesAcceptanceRequired"]) {
    if ((sourceData[field] ?? null) !== (targetData[field] ?? null)) event.push(`${field} : ${sourceData[field] ?? "—"} → ${targetData[field] ?? "—"}`);
  }

  const targetCategoryIds = new Set(targetCategories.docs.map(doc => doc.id));
  const sourceCategoryIds = new Set(sourceCategories.docs.map(doc => doc.id));
  const targetByName = new Map(targetCategories.docs.map(doc => [key(doc.data().name), doc]));
  const sourceByName = new Map(sourceCategories.docs.map(doc => [key(doc.data().name), doc]));
  const categories: EditionComparison["categories"] = [];
  for (const [name, doc] of sourceByName) {
    const other = targetByName.get(name);
    if (!other) {
      categories.push({ name: doc.data().name, status: "missing_in_target", sourceId: doc.id, differences: [] });
      continue;
    }
    const a = doc.data();
    const b = other.data();
    const differences: string[] = [];
    if (Number(a.unitPrice) !== Number(b.unitPrice)) differences.push(`tarif ${a.unitPrice} € → ${b.unitPrice} €`);
    if (Number(a.participantsPerSlot ?? 1) !== Number(b.participantsPerSlot ?? 1)) differences.push(`participants par créneau ${a.participantsPerSlot ?? 1} → ${b.participantsPerSlot ?? 1}`);
    if (Number(a.durationMinutes) !== Number(b.durationMinutes)) differences.push(`durée ${a.durationMinutes} → ${b.durationMinutes} min`);
    if (Number(a.maxSlots) !== Number(b.maxSlots)) differences.push(`capacité ${a.maxSlots} → ${b.maxSlots}`);
    if ((a.isActive !== false) !== (b.isActive !== false)) differences.push(`active ${a.isActive !== false} → ${b.isActive !== false}`);
    if (!b.rulesI18n?.published) differences.push("règlement non publié dans l'édition cible");
    categories.push({ name: b.name, status: differences.length ? "different" : "same", sourceId: doc.id, targetId: other.id, differences });
  }
  for (const [name, doc] of targetByName) {
    if (!sourceByName.has(name)) categories.push({ name: doc.data().name, status: "only_in_target", targetId: doc.id, differences: [] });
  }

  const sourceProductsByName = new Map(sourceProducts.docs.map(doc => [key(doc.data().name), doc]));
  const products: EditionComparison["products"] = [];
  for (const doc of targetProducts.docs) {
    const data = doc.data();
    const links: string[] = data.excludedCategoryIds ?? [];
    const sourceMatch = sourceProductsByName.get(key(data.name));
    const differences: string[] = [];
    if (sourceMatch && Number(sourceMatch.data().unitAmount) !== Number(data.unitAmount)) differences.push(`tarif ${sourceMatch.data().unitAmount} € → ${data.unitAmount} €`);
    products.push({
      name: data.name,
      status: sourceMatch ? (differences.length ? "different" : "same") : "only_in_target",
      targetId: doc.id,
      differences,
      linksToOtherEdition: links.filter(id => sourceCategoryIds.has(id)),
      unknownLinks: links.filter(id => !targetCategoryIds.has(id) && !sourceCategoryIds.has(id)),
    });
  }
  for (const [name, doc] of sourceProductsByName) {
    if (!targetProducts.docs.some(other => key(other.data().name) === name)) products.push({ name: doc.data().name, status: "missing_in_target", differences: [], linksToOtherEdition: [], unknownLinks: [] });
  }

  const booked = targetSlots.docs.filter(doc => doc.data().status !== "available").length;
  const activeCategories = targetCategories.docs.filter(doc => doc.data().isActive !== false);
  const checklist: EditionComparison["checklist"] = [
    { item: "Nom, année et dates", ok: !!targetData.name && !!targetData.eventStartDate, detail: `${targetData.name ?? "—"} (${targetData.eventYear ?? "—"})` },
    { item: "Catégories", ok: activeCategories.length > 0, detail: `${activeCategories.length} active(s)` },
    { item: "Prix vérifiés", ok: !targetCategories.docs.some(doc => doc.data().priceReview === "to_check"), detail: `${targetCategories.docs.filter(doc => doc.data().priceReview === "to_check").length} catégorie(s) « reprise — à vérifier »` },
    { item: "Règlements publiés", ok: activeCategories.every(doc => doc.data().rulesI18n?.published), detail: `${activeCategories.filter(doc => !doc.data().rulesI18n?.published).length} catégorie(s) active(s) sans règlement publié` },
    { item: "Créneaux", ok: targetSlots.size > 0, detail: `${targetSlots.size} créneau(x), ${booked} occupé(s)` },
    { item: "Liens des packs", ok: products.every(product => !product.linksToOtherEdition.length && !product.unknownLinks.length), detail: `${products.filter(product => product.linksToOtherEdition.length).length} pack(s) liés à une autre édition` },
    { item: "Repas", ok: Number(targetData.mealPrice ?? 0) > 0, detail: `${targetData.mealPrice ?? 0} €` },
  ];

  return {
    source: { id: sourceId, name: sourceData.name },
    target: { id: targetId, name: targetData.name, status: targetData.status, payments: targetPayments.size, bookedSlots: booked, slots: targetSlots.size },
    event,
    categories: categories.sort((a, b) => a.name.localeCompare(b.name, "fr")),
    products,
    checklist,
  };
}

/**
 * Réparation sélective : ajoute des catégories manquantes (copiées en
 * brouillon, prix « à vérifier ») et remappe les exclusions de packs qui
 * pointent vers l'autre édition. Rien d'existant n'est écrasé.
 */
export async function repairEdition(
  db: Firestore,
  input: { sourceId: string; targetId: string; copyCategoryIds?: string[]; remapProductIds?: string[] },
  context: ActionContext
) {
  const at = Timestamp.fromDate(context.now ?? new Date());
  const comparison = await compareEditions(db, input.sourceId, input.targetId);
  const created: string[] = [];
  const remapped: Array<{ productId: string; unresolved: string[] }> = [];

  await db.runTransaction(async tx => {
    const missing = comparison.categories.filter(category => category.status === "missing_in_target" && (input.copyCategoryIds ?? []).includes(category.sourceId!));
    const sourceDocs = await Promise.all(missing.map(category => tx.get(db.collection("categories").doc(category.sourceId!))));
    const targetCategories = await tx.get(db.collection("categories").where("eventId", "==", input.targetId));
    const sourceCategories = await tx.get(db.collection("categories").where("eventId", "==", input.sourceId));
    const products = await Promise.all((input.remapProductIds ?? []).map(id => tx.get(db.collection("products").doc(id))));

    const targetIdByName = new Map(targetCategories.docs.map(doc => [key(doc.data().name), doc.id]));
    sourceDocs.forEach(doc => {
      const data = doc.data()!;
      const newId = `${input.targetId}_${doc.id}`;
      tx.create(db.collection("categories").doc(newId), {
        eventId: input.targetId, name: data.name, nameI18n: data.nameI18n ?? {}, description: data.description ?? "", rules: data.rules ?? "",
        unitPrice: Number(data.unitPrice ?? 0), maxSlots: Number(data.maxSlots ?? 0), durationMinutes: Number(data.durationMinutes ?? 0),
        participantsPerSlot: Number(data.participantsPerSlot ?? 1), isActive: false, activeDates: [],
        rulesI18n: { draft: { texts: data.rulesI18n?.published?.texts ?? data.rulesI18n?.draft?.texts ?? {}, updatedAt: at, updatedBy: context.actor.uid } },
        copiedFrom: { eventId: input.sourceId, categoryId: doc.id, unitPrice: Number(data.unitPrice ?? 0) }, priceReview: "to_check",
      });
      targetIdByName.set(key(data.name), newId);
      created.push(newId);
    });

    const sourceNameById = new Map(sourceCategories.docs.map(doc => [doc.id, key(doc.data().name)]));
    products.forEach(product => {
      if (!product.exists || product.data()!.eventId !== input.targetId) return;
      const links: string[] = product.data()!.excludedCategoryIds ?? [];
      const unresolved: string[] = [];
      const next = links.map(id => {
        if (!sourceNameById.has(id)) return id;
        const mappedId = targetIdByName.get(sourceNameById.get(id)!);
        if (!mappedId) unresolved.push(id);
        return mappedId ?? id;
      });
      tx.update(product.ref, { excludedCategoryIds: next });
      remapped.push({ productId: product.id, unresolved });
    });

    tx.set(db.collection("auditLogs").doc(), {
      eventId: input.targetId, entity: "event", entityId: input.targetId, action: "event.repair",
      actorUid: context.actor.uid, actorName: context.actor.displayName,
      before: null, after: { createdCategories: created, remapped }, reason: context.reason ?? null, at,
    });
  });
  return { createdCategories: created, remappedProducts: remapped };
}
