import { beforeEach, describe, expect, it } from "vitest";
import { publishRules, saveRulesDraft } from "@/lib/server/rules/publish";
import { ParticipantActionError } from "@/lib/server/participants/service";
import { isAcceptanceValid, resolveRulesForLang, parseRuleText } from "@/lib/domain/category-rules";
import { resetDb, testDb } from "../helpers/emulator";
import { seedCategory } from "../helpers/fixtures";

const db = testDb();
const admin = { actor: { uid: "admin1", displayName: "Admin WPT" } };
const code = (c: string) => (error: unknown) => error instanceof ParticipantActionError && error.code === c;

beforeEach(async () => {
  await resetDb();
  await seedCategory(db, "classique", { name: "Pizza Classique" });
});

describe("publication des règlements", () => {
  it("un brouillon n'est pas visible tant qu'il n'est pas publié ; la publication crée une version immuable", async () => {
    await saveRulesDraft(db, { categoryId: "classique", texts: { fr: "Règle 1", en: "Rule 1" }, nameI18n: { en: "Classic Pizza" } }, admin);
    let category = (await db.collection("categories").doc("classique").get()).data()!;
    expect(category.rulesI18n.published).toBeUndefined();
    expect(category.nameI18n).toEqual({ en: "Classic Pizza" });

    const first = await publishRules(db, { categoryId: "classique", expectedPublishedVersion: 0 }, admin);
    await saveRulesDraft(db, { categoryId: "classique", texts: { fr: "Règle 1 modifiée" } }, admin);
    category = (await db.collection("categories").doc("classique").get()).data()!;
    // Brouillon modifié : la version publiée (vue par le Booking) ne bouge pas.
    expect(category.rulesI18n.published).toMatchObject({ version: 1, texts: { fr: "Règle 1", en: "Rule 1" }, publishedBy: "admin1" });

    const second = await publishRules(db, { categoryId: "classique", expectedPublishedVersion: 1 }, admin);
    expect(second.version).toBe(2);
    // L'ancienne version reste intacte pour les acceptations passées.
    expect((await db.collection("ruleVersions").doc(first.versionId).get()).data()!.texts.fr).toBe("Règle 1");
    const acceptanceV1 = { version: 1, ruleVersionId: first.versionId, requestedLang: "fr", displayedLang: "fr" };
    category = (await db.collection("categories").doc("classique").get()).data()!;
    expect(isAcceptanceValid(category.rulesI18n.published, acceptanceV1)).toBe(false);
  });

  it("refuse une publication concurrente et une publication sans texte de référence", async () => {
    await saveRulesDraft(db, { categoryId: "classique", texts: { en: "Only English" } }, admin);
    await expect(publishRules(db, { categoryId: "classique", expectedPublishedVersion: 0 }, admin)).rejects.toSatisfy(code("reference_text_required"));
    await saveRulesDraft(db, { categoryId: "classique", texts: { fr: "Texte" } }, admin);
    await publishRules(db, { categoryId: "classique", expectedPublishedVersion: 0 }, admin);
    await expect(publishRules(db, { categoryId: "classique", expectedPublishedVersion: 0 }, admin)).rejects.toSatisfy(code("version_conflict"));
  });

  it("traduction absente : repli annoncé sur le français, jamais un texte vide", () => {
    const published = { version: 3, versionId: "classique_v3", texts: { fr: "Texte FR", it: "Testo IT" }, referenceLang: "fr" as const };
    expect(resolveRulesForLang(published, "it")).toMatchObject({ status: "ok", displayedLang: "it", isFallback: false });
    expect(resolveRulesForLang(published, "es")).toMatchObject({ status: "ok", displayedLang: "fr", isFallback: true });
    expect(resolveRulesForLang({ ...published, texts: { it: "Testo" } }, "es")).toEqual({ status: "no_text" });
    expect(resolveRulesForLang(null, "fr")).toEqual({ status: "not_published" });
  });

  it("le rendu ne produit jamais de HTML : balises affichées comme du texte", () => {
    const blocks = parseRuleText("## Matériel\n- Four <script>alert(1)</script>\n\nParagraphe <b>gras</b>");
    expect(blocks).toEqual([
      { kind: "heading", text: "Matériel" },
      { kind: "list", items: ["Four <script>alert(1)</script>"] },
      { kind: "paragraph", text: "Paragraphe <b>gras</b>" },
    ]);
  });
});
