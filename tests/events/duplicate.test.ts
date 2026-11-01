import { beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { duplicateEdition, previewDuplication, resumeDuplication } from "@/lib/server/events/duplicate";
import { compareEditions, repairEdition } from "@/lib/server/events/compare";
import { wallTime } from "@/lib/domain/timezone";
import { resetDb, testDb } from "../helpers/emulator";
import { count } from "../helpers/fixtures";

const db = testDb();
const admin = { actor: { uid: "admin1", displayName: "Admin WPT" } };
const SOURCE = "evt2026";
const input = (requestId: string, extra: object = {}) => ({
  sourceEventId: SOURCE, requestId, name: "World Pizza Trophy 2027", eventYear: 2027,
  eventStartDate: "2027-10-26", eventEndDate: "2027-10-27", registrationDeadline: "2027-10-20", ...extra,
});

beforeEach(async () => {
  await resetDb();
  await db.collection("events").doc(SOURCE).set({ name: "WPT 2026", eventYear: 2026, status: "completed", mealPrice: 30, minSlotsPerBooking: 2 });
  await db.collection("categories").doc("classique").set({
    eventId: SOURCE, name: "Pizza Classique", unitPrice: 70, durationMinutes: 12, maxSlots: 30, participantsPerSlot: 1, isActive: true, activeDates: ["2026-10-27"],
    rulesI18n: { published: { version: 3, versionId: "classique_v3", texts: { fr: "Règles FR", en: "Rules EN" } } },
  });
  await db.collection("categories").doc("due").set({ eventId: SOURCE, name: "Pizza Due", unitPrice: 120, durationMinutes: 20, maxSlots: 10, participantsPerSlot: 2, isActive: true, activeDates: ["2026-10-28"] });
  await db.collection("products").doc("pack").set({ eventId: SOURCE, name: "Pack Or", unitAmount: 150, slotsRequired: 2, isPack: true, mealsIncluded: 1, excludedCategoryIds: ["due"], isActive: true, stripePriceId: "price_live_123" });
  // Créneau du 27/10/2026 (heure d'hiver depuis le 25/10) à 11 h 15, et un du 28/10 réservé et payé.
  await db.collection("slots").doc("s1").set({ eventId: SOURCE, categoryId: "classique", date: "2026-10-27", status: "paid", buyerId: "buyer1", stripeSessionId: "cs_1", participants: [{ firstName: "Kévin", lastName: "PROSPER", phone: "06" }], startTime: Timestamp.fromDate(new Date("2026-10-27T10:15:00Z")), endTime: Timestamp.fromDate(new Date("2026-10-27T10:27:00Z")) });
  await db.collection("slots").doc("s2").set({ eventId: SOURCE, categoryId: "due", date: "2026-10-28", status: "available", startTime: Timestamp.fromDate(new Date("2026-10-28T13:00:00Z")), endTime: Timestamp.fromDate(new Date("2026-10-28T13:20:00Z")) });
  await db.collection("payments").doc("cs_1").set({ eventId: SOURCE, userId: "buyer1", amount: 70, status: "paid" });
  await db.collection("participants").doc("p1").set({ eventId: SOURCE, firstName: "Kévin", lastName: "PROSPER" });
  await db.collection("vouchers").doc("v1").set({ eventId: SOURCE, code: "PROMO26" });
});

describe("duplication d'édition", () => {
  it("aperçu : jours, horaires locaux et éléments non copiés", async () => {
    const preview = await previewDuplication(db, SOURCE);
    expect(preview.days).toEqual([
      expect.objectContaining({ index: 0, sourceDate: "2026-10-27", firstStart: "11:15", categories: ["Pizza Classique"] }),
      expect.objectContaining({ index: 1, sourceDate: "2026-10-28", firstStart: "14:00" }),
    ]);
    expect(preview.notCopied).toContain("commandes, paiements et factures");
  });

  it("copie la configuration en brouillon, remappe les liens, ne copie aucune donnée de 2026", async () => {
    const result = await duplicateEdition(db, input("req-2027-a", { dayMapping: ["2027-10-26", "2027-10-27"] }), admin);
    expect(result).toMatchObject({ created: true, categories: 2, products: 1, slots: 2 });

    const event = (await db.collection("events").doc(result.eventId).get()).data()!;
    expect(event).toMatchObject({ status: "draft", mealPrice: 30, rulesAcceptanceRequired: true, copiedFrom: { eventId: SOURCE } });

    const categories = await db.collection("categories").where("eventId", "==", result.eventId).get();
    const due = categories.docs.find(doc => doc.data().name === "Pizza Due")!;
    expect(due.data()).toMatchObject({ participantsPerSlot: 2, unitPrice: 120, priceReview: "to_check", activeDates: ["2027-10-27"] });
    const classique = categories.docs.find(doc => doc.data().name === "Pizza Classique")!.data();
    // Règlement repris en brouillon : à republier pour 2027.
    expect(classique.rulesI18n.published).toBeUndefined();
    expect(classique.rulesI18n.draft.texts).toEqual({ fr: "Règles FR", en: "Rules EN" });

    const pack = (await db.collection("products").where("eventId", "==", result.eventId).get()).docs[0].data();
    expect(pack.excludedCategoryIds).toEqual([due.id]);
    expect(pack).toMatchObject({ stripePriceId: "", mealsIncluded: 1, priceReview: "to_check" });

    const slots = (await db.collection("slots").where("eventId", "==", result.eventId).get()).docs.map(doc => doc.data());
    expect(slots.every(slot => slot.status === "available" && !slot.buyerId && !slot.participants && !slot.stripeSessionId)).toBe(true);
    // 11 h 15 à Paris reste 11 h 15 (heure d'été le 26/10/2027).
    const first = slots.find(slot => slot.date === "2027-10-26")!;
    expect(wallTime(first.startTime.toDate())).toMatchObject({ date: "2027-10-26", hour: 11, minute: 15 });

    for (const collection of ["payments", "participants", "vouchers"]) {
      expect((await db.collection(collection).where("eventId", "==", result.eventId).get()).size).toBe(0);
    }
  });

  it("sans dates de jours : configuration copiée, aucun créneau inventé", async () => {
    const result = await duplicateEdition(db, input("req-2027-b"), admin);
    expect(result.slots).toBe(0);
    expect((await db.collection("events").doc(result.eventId).get()).data()!.review.slots).toBe("to_create");
  });

  it("double clic : une seule édition ; reprise après interruption sans doublon", async () => {
    const [first, second] = await Promise.allSettled([duplicateEdition(db, input("req-2027-c"), admin), duplicateEdition(db, input("req-2027-c"), admin)]);
    const fulfilled = [first, second].filter(result => result.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect((await db.collection("events").where("eventYear", "==", 2027).get()).size).toBe(1);
    const again = await duplicateEdition(db, input("req-2027-c"), admin);
    expect(again.created).toBe(false);

    // Interruption simulée : requête restée « en cours ».
    await db.collection("duplicationRequests").doc("req-2027-c").update({ status: "in_progress" });
    const resumed = await resumeDuplication(db, input("req-2027-c"), admin);
    expect(resumed.eventId).toBe(again.eventId);
    expect((await db.collection("events").where("eventYear", "==", 2027).get()).size).toBe(1);
    expect(await count(db, "categories")).toBe(4);
  });

  it("indépendance : modifier 2027 ne modifie jamais 2026", async () => {
    const result = await duplicateEdition(db, input("req-2027-d"), admin);
    const copy = (await db.collection("categories").where("eventId", "==", result.eventId).get()).docs[0];
    await copy.ref.update({ unitPrice: 999, "rulesI18n.draft.texts.fr": "modifié" });
    const original = (await db.collection("categories").doc(copy.data().copiedFrom.categoryId).get()).data()!;
    expect(original.unitPrice).not.toBe(999);
    expect(original.rulesI18n?.published?.texts?.fr ?? "").not.toBe("modifié");
  });
});

describe("édition existante (cas 2027) : diagnostic et réparation sélective", () => {
  beforeEach(async () => {
    await db.collection("events").doc("evt2027").set({ name: "WPT 2027", eventYear: 2027, status: "draft", mealPrice: 35 });
    await db.collection("categories").doc("c27").set({ eventId: "evt2027", name: "Pizza classique", unitPrice: 75, durationMinutes: 12, maxSlots: 30, participantsPerSlot: 1, isActive: true });
    // Pack créé à la main en 2027, mais dont l'exclusion pointe encore vers la catégorie 2026.
    await db.collection("products").doc("p27").set({ eventId: "evt2027", name: "Pack Or", unitAmount: 160, slotsRequired: 2, excludedCategoryIds: ["due"] });
    await db.collection("payments").doc("pay27").set({ eventId: "evt2027", userId: "early", amount: 75, status: "paid" });
  });

  it("signale l'existant, le manquant, les liens vers 2026 et les écarts de prix", async () => {
    const comparison = await compareEditions(db, SOURCE, "evt2027");
    expect(comparison.target).toMatchObject({ payments: 1 });
    expect(comparison.event).toContain("mealPrice : 30 → 35");
    expect(comparison.categories).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Pizza classique", status: "different", differences: expect.arrayContaining(["tarif 70 € → 75 €", "règlement non publié dans l'édition cible"]) }),
      expect.objectContaining({ name: "Pizza Due", status: "missing_in_target" }),
    ]));
    expect(comparison.products[0]).toMatchObject({ name: "Pack Or", linksToOtherEdition: ["due"], differences: ["tarif 150 € → 160 €"] });
  });

  it("réparation sélective : ajoute la catégorie manquante et remappe le pack, sans toucher prix ni inscriptions", async () => {
    const result = await repairEdition(db, { sourceId: SOURCE, targetId: "evt2027", copyCategoryIds: ["due"], remapProductIds: ["p27"] }, admin);
    expect(result.createdCategories).toEqual(["evt2027_due"]);
    expect((await db.collection("products").doc("p27").get()).data()!).toMatchObject({ excludedCategoryIds: ["evt2027_due"], unitAmount: 160 });
    expect((await db.collection("categories").doc("c27").get()).data()!.unitPrice).toBe(75);
    expect((await db.collection("categories").doc("evt2027_due").get()).data()!).toMatchObject({ isActive: false, priceReview: "to_check", participantsPerSlot: 2 });
    expect((await db.collection("payments").doc("pay27").get()).exists).toBe(true);
    expect((await db.collection("events").where("eventYear", "==", 2027).get()).size).toBe(1);
  });
});
