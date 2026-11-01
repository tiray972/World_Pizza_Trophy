import { beforeEach, describe, expect, it } from "vitest";
import { bookingTexts } from "@/lib/i18n/booking-texts";
import { RULES_DIALOG_TEXTS } from "@/lib/i18n/rules-dialog-texts";
import { AUTH_TEXTS } from "@/lib/i18n/auth-texts";
import { resultsCopy } from "@/lib/results/copy";
import { minSlotsErrorMessage, validateBookingSelection } from "@/lib/booking/rules";
import { CheckoutError, prepareCheckout } from "@/lib/server/booking/checkout-service";
import { resetDb, testDb } from "../helpers/emulator";
import { EVENT_ID, seedCategory, seedEvent, seedSlot, seedUser } from "../helpers/fixtures";

const LANGS = ["fr", "en", "es", "it"] as const;

/** Toutes les clés (aplaties) d'un dictionnaire, avec leurs valeurs. */
function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  return Object.entries(value as Record<string, unknown>).reduce(
    (all, [key, nested]) => ({ ...all, ...flatten(nested, prefix ? `${prefix}.${key}` : key) }),
    {} as Record<string, string>
  );
}

describe("traductions du Booking, du règlement, de l'inscription et des résultats", () => {
  for (const [name, get] of [
    ["booking", (lang: string) => bookingTexts(lang)],
    ["règlement", (lang: string) => RULES_DIALOG_TEXTS[lang as keyof typeof RULES_DIALOG_TEXTS]],
    ["inscription", (lang: string) => AUTH_TEXTS[lang as keyof typeof AUTH_TEXTS]],
    ["résultats", (lang: string) => resultsCopy[lang as keyof typeof resultsCopy]],
  ] as const) {
    it(`${name} : mêmes clés dans les 4 langues, aucune vide, variables identiques`, () => {
      const reference = flatten(get("fr"));
      for (const lang of LANGS) {
        const texts = flatten(get(lang));
        expect(Object.keys(texts).sort()).toEqual(Object.keys(reference).sort());
        for (const [key, value] of Object.entries(texts)) {
          expect(value.trim(), `${lang}.${key}`).not.toBe("");
          const variables = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
          expect(variables(value), `${lang}.${key}`).toEqual(variables(reference[key]));
        }
      }
    });
  }

  it("les textes non français ne sont pas restés en français", () => {
    expect(bookingTexts("en").checkout).not.toBe(bookingTexts("fr").checkout);
    expect(bookingTexts("es").cartTitle).toBe("Tu carrito");
    expect(bookingTexts("it").successTitle).toContain("Pagamento confermato");
    expect(bookingTexts("de").checkout).toBe(bookingTexts("fr").checkout);
  });

  it("messages de validation dans la langue demandée", () => {
    expect(minSlotsErrorMessage(2, "en")).toContain("at least 2 different categories");
    const errors = validateBookingSelection({
      slots: [{ slotId: "d1", categoryId: "due", participants: [{ firstName: "Marine", lastName: "B", shirtSize: "S" }] }],
      participantsPerCategory: { due: 2 },
      categoryNames: { due: "Pizza Due" },
      minSlots: 1,
      lang: "it",
    });
    expect(errors).toEqual(["Pizza Due si disputa in 2: inserisci i 2 partecipanti (nome, cognome e taglia della maglietta)."]);
  });
});

describe("le serveur répond dans la langue du Booking", () => {
  const db = testDb();
  beforeEach(async () => {
    await resetDb();
    await seedEvent(db);
    await seedCategory(db, "due", { participantsPerSlot: 2, name: "Pizza Due" });
    await seedSlot(db, "d1", "due");
    await seedUser(db, "buyer1");
  });

  it("duo incomplet refusé avec un message en espagnol", async () => {
    await expect(
      prepareCheckout(db, {
        buyer: { uid: "buyer1", email: "b@x.test" }, eventId: EVENT_ID, lang: "es", now: new Date("2027-09-01T10:00:00Z"),
        slots: [{ slotId: "d1", participants: [{ firstName: "Marine", lastName: "B", shirtSize: "S" }] }],
      })
    ).rejects.toSatisfy((error: unknown) => error instanceof CheckoutError && error.message.startsWith("Pizza Due se disputa entre 2"));
  });
});
