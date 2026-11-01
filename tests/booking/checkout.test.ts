import { beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { attachCheckoutSession, CheckoutError, prepareCheckout, releaseCheckout } from "@/lib/server/booking/checkout-service";
import { finalizeCheckoutSession } from "@/lib/server/payments/finalize";
import { ruleVersionId } from "@/lib/domain/category-rules";
import { resetDb, testDb } from "../helpers/emulator";
import { EVENT_ID, paidSession, seedCategory, seedEvent, seedSlot, seedUser } from "../helpers/fixtures";

const db = testDb();
const NOW = new Date("2027-09-01T10:00:00Z");
const buyer = { uid: "buyer1", email: "buyer1@example.test" };
const kevin = { firstName: "Kévin", lastName: "PROSPER", shirtSize: "L" as const };
const marine = { firstName: "Marine", lastName: "BRIANÇON", shirtSize: "S" as const };
const jeremy = { firstName: "Jeremy", lastName: "CHION", shirtSize: "M" as const };

const published = (categoryId: string, version = 1, texts: Record<string, string> = { fr: "Règles officielles", en: "Official rules" }) => ({
  rulesI18n: {
    published: {
      version,
      versionId: ruleVersionId(categoryId, version),
      texts,
      referenceLang: "fr",
      publishedAt: Timestamp.fromDate(NOW),
      publishedBy: "admin1",
    },
  },
});

const acceptance = (categoryId: string, version = 1, lang = "fr", displayedLang = lang) => ({
  categoryId,
  ruleVersionId: ruleVersionId(categoryId, version),
  version,
  requestedLang: lang,
  displayedLang,
  acceptedAt: NOW.toISOString(),
});

async function expectCheckoutError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((error: unknown) => error instanceof CheckoutError && error.code === code);
}

beforeEach(async () => {
  await resetDb();
  await seedEvent(db);
  await seedCategory(db, "classique", { unitPrice: 70 });
  await seedCategory(db, "calzone", { unitPrice: 60 });
  await seedCategory(db, "due", { unitPrice: 120, participantsPerSlot: 2 });
  await seedSlot(db, "s1", "classique");
  await seedSlot(db, "s2", "calzone");
  await seedSlot(db, "d1", "due");
  await seedUser(db, "buyer1");
  await seedUser(db, "buyer2");
});

describe("prepareCheckout", () => {
  it("recalcule le prix côté serveur et verrouille les créneaux", async () => {
    const prepared = await prepareCheckout(db, {
      buyer,
      eventId: EVENT_ID,
      slots: [{ slotId: "s1", participants: [kevin] }, { slotId: "s2", participants: [kevin] }],
      mealGuests: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "", lastName: "" }],
      now: NOW,
    });

    expect(prepared.totalAmount).toBe(70 + 60 + 30);
    expect(prepared.lineItems.map(item => [item.unitAmountCents, item.quantity])).toEqual([[13000, 1], [3000, 1]]);
    const slot = (await db.collection("slots").doc("s1").get()).data()!;
    expect(slot).toMatchObject({ status: "locked", lockedByUserId: "buyer1", pendingBookingId: prepared.pendingBookingId });
    const pending = (await db.collection("pendingBookings").doc(prepared.pendingBookingId).get()).data()!;
    expect(pending.mealQuantity).toBe(1);
  });

  it("refuse un montant affiché différent du prix en base", async () => {
    await expectCheckoutError(
      prepareCheckout(db, { buyer, eventId: EVENT_ID, slots: [{ slotId: "s1", participants: [kevin] }], clientTotal: 1, now: NOW }),
      "price_changed"
    );
    expect((await db.collection("slots").doc("s1").get()).data()!.status).toBe("available");
  });

  it("refuse une édition archivée, close ou dont la date limite est passée", async () => {
    await db.collection("events").doc(EVENT_ID).update({ status: "archived" });
    await expectCheckoutError(
      prepareCheckout(db, { buyer, eventId: EVENT_ID, slots: [{ slotId: "s1", participants: [kevin] }], now: NOW }),
      "event_not_open"
    );
    await db.collection("events").doc(EVENT_ID).update({ status: "open" });
    await expectCheckoutError(
      prepareCheckout(db, { buyer, eventId: EVENT_ID, slots: [{ slotId: "s1", participants: [kevin] }], now: new Date("2027-10-25T00:00:00Z") }),
      "registration_deadline_passed"
    );
  });

  it("refuse un créneau d'une autre édition", async () => {
    await seedSlot(db, "old", "classique", { eventId: "evt2026" });
    await expectCheckoutError(
      prepareCheckout(db, { buyer, eventId: EVENT_ID, slots: [{ slotId: "old", participants: [kevin] }], now: NOW }),
      "slot_unavailable"
    );
  });

  it("deux acheteurs simultanés sur le même créneau : un seul obtient le verrou", async () => {
    const attempts = await Promise.allSettled(
      ["buyer1", "buyer2"].map(uid =>
        prepareCheckout(db, { buyer: { uid, email: `${uid}@example.test` }, eventId: EVENT_ID, slots: [{ slotId: "s1", participants: [kevin] }], now: NOW })
      )
    );
    expect(attempts.filter(attempt => attempt.status === "fulfilled")).toHaveLength(1);
    const refused = attempts.find(attempt => attempt.status === "rejected") as PromiseRejectedResult;
    expect((refused.reason as CheckoutError).code).toBe("slot_unavailable");
  });

  it("duo : exige les deux équipiers", async () => {
    await expectCheckoutError(
      prepareCheckout(db, { buyer, eventId: EVENT_ID, slots: [{ slotId: "d1", participants: [marine] }], now: NOW }),
      "booking_rules"
    );
    const prepared = await prepareCheckout(db, { buyer, eventId: EVENT_ID, slots: [{ slotId: "d1", participants: [marine, jeremy] }], now: NOW });
    expect(prepared.totalAmount).toBe(120);
  });

  it("pack : prix du produit, repas inclus à compléter", async () => {
    await db.collection("products").doc("pack1").set({
      eventId: EVENT_ID, name: "Pack Or", unitAmount: 150, slotsRequired: 2, isActive: true, isPack: true, mealsIncluded: 1, excludedCategoryIds: ["due"],
    });
    const prepared = await prepareCheckout(db, {
      buyer, eventId: EVENT_ID, pack: { productId: "pack1" },
      slots: [{ slotId: "s1", participants: [kevin] }, { slotId: "s2", participants: [kevin] }], now: NOW,
    });
    expect(prepared.totalAmount).toBe(150);
    const pending = (await db.collection("pendingBookings").doc(prepared.pendingBookingId).get()).data()!;
    expect(pending.mealQuantity).toBe(1);

    await expectCheckoutError(
      prepareCheckout(db, { buyer, eventId: EVENT_ID, pack: { productId: "pack1" }, slots: [{ slotId: "d1", participants: [marine, jeremy] }, { slotId: "s1", participants: [kevin] }], now: NOW }),
      "pack_category_excluded"
    );
  });

  it("libère uniquement les verrous de sa propre réservation", async () => {
    const prepared = await prepareCheckout(db, { buyer, eventId: EVENT_ID, slots: [{ slotId: "s1", participants: [kevin] }], now: NOW });
    await db.collection("slots").doc("s2").update({ status: "locked", pendingBookingId: "other", lockedByUserId: "buyer2" });
    await releaseCheckout(db, { pendingBookingId: prepared.pendingBookingId, slotIds: ["s1", "s2"] });
    expect((await db.collection("slots").doc("s1").get()).data()!.status).toBe("available");
    expect((await db.collection("slots").doc("s2").get()).data()!.status).toBe("locked");
  });
});

describe("règlement exigé par l'édition", () => {
  beforeEach(async () => {
    await db.collection("events").doc(EVENT_ID).update({ rulesAcceptanceRequired: true });
    await db.collection("categories").doc("classique").update(published("classique", 2));
  });

  it("refuse sans acceptation, ou avec une version périmée", async () => {
    await expectCheckoutError(
      prepareCheckout(db, { buyer, eventId: EVENT_ID, slots: [{ slotId: "s1", participants: [kevin] }], now: NOW }),
      "rules_acceptance_required"
    );
    await expectCheckoutError(
      prepareCheckout(db, { buyer, eventId: EVENT_ID, slots: [{ slotId: "s1", participants: [kevin] }], ruleAcceptances: [acceptance("classique", 1)], now: NOW }),
      "rules_acceptance_required"
    );
  });

  it("une catégorie sans règlement publié n'est pas réservable", async () => {
    await expectCheckoutError(
      prepareCheckout(db, { buyer, eventId: EVENT_ID, slots: [{ slotId: "s2", participants: [kevin] }], ruleAcceptances: [acceptance("classique", 2)], now: NOW }),
      "rules_acceptance_required"
    );
  });

  it("l'acceptation d'une catégorie ne vaut pas pour une autre", async () => {
    await db.collection("categories").doc("calzone").update(published("calzone", 1));
    await expectCheckoutError(
      prepareCheckout(db, {
        buyer, eventId: EVENT_ID, now: NOW, ruleAcceptances: [acceptance("classique", 2)],
        slots: [{ slotId: "s1", participants: [kevin] }, { slotId: "s2", participants: [kevin] }],
      }),
      "rules_acceptance_required"
    );
  });

  it("repli linguistique : accepté seulement si la langue réellement présentée est enregistrée", async () => {
    // Espagnol absent : texte de référence (français) présenté.
    await expectCheckoutError(
      prepareCheckout(db, { buyer, eventId: EVENT_ID, slots: [{ slotId: "s1", participants: [kevin] }], ruleAcceptances: [acceptance("classique", 2, "es", "es")], now: NOW }),
      "rules_acceptance_required"
    );
    const prepared = await prepareCheckout(db, {
      buyer, eventId: EVENT_ID, slots: [{ slotId: "s1", participants: [kevin] }], ruleAcceptances: [acceptance("classique", 2, "es", "fr")], now: NOW,
    });
    const pending = (await db.collection("pendingBookings").doc(prepared.pendingBookingId).get()).data()!;
    expect(pending.ruleAcceptances).toEqual([expect.objectContaining({ categoryId: "classique", version: 2, requestedLang: "es", displayedLang: "fr" })]);
  });

  it("parcours complet : acceptation enregistrée avec la commande payée", async () => {
    const prepared = await prepareCheckout(db, {
      buyer, eventId: EVENT_ID, slots: [{ slotId: "s1", participants: [kevin] }], ruleAcceptances: [acceptance("classique", 2, "en")], now: NOW,
    });
    await attachCheckoutSession(db, prepared, "cs_rules");
    const result = await finalizeCheckoutSession(db, paidSession("cs_rules", prepared.metadata, 7000), { source: "webhook", now: NOW });

    expect(result.status).toBe("created");
    const recorded = (await db.collection("ruleAcceptances").doc("cs_rules_classique").get()).data()!;
    expect(recorded).toMatchObject({
      eventId: EVENT_ID, categoryId: "classique", version: 2, displayedLang: "en", actorUserId: "buyer1", actorRole: "buyer", paymentId: "cs_rules",
    });
    expect(recorded.participantIds).toEqual(result.participantIds);
  });

  it("parcours complet sans session rattachée : la finalisation reconnaît le verrou de la réservation", async () => {
    const prepared = await prepareCheckout(db, {
      buyer, eventId: EVENT_ID, slots: [{ slotId: "s1", participants: [kevin] }], ruleAcceptances: [acceptance("classique", 2)], now: NOW,
    });
    const result = await finalizeCheckoutSession(db, paidSession("cs_late", prepared.metadata, 7000), { source: "webhook", now: NOW });
    expect(result.slotIds).toEqual(["s1"]);
    expect(result.conflicts).toEqual([]);
  });
});

describe("édition sans exigence de règlement (rétrocompatibilité)", () => {
  it("n'exige rien mais enregistre une acceptation valable transmise", async () => {
    await db.collection("categories").doc("classique").update(published("classique", 1));
    const prepared = await prepareCheckout(db, {
      buyer, eventId: EVENT_ID, slots: [{ slotId: "s1", participants: [kevin] }, { slotId: "s2", participants: [kevin] }],
      ruleAcceptances: [acceptance("classique", 1)], now: NOW,
    });
    const pending = (await db.collection("pendingBookings").doc(prepared.pendingBookingId).get()).data()!;
    expect(pending.ruleAcceptances).toHaveLength(1);
  });
});
