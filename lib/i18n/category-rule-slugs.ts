// Rapprochement entre une catégorie de la base et son règlement statique du
// site (dictionnaires). Sert uniquement à préremplir un brouillon que
// l'administrateur relit avant publication.

export const CATEGORY_RULE_MATCHERS: Record<string, string[]> = {
  classique: ["classique", "classica", "classic"],
  calzone: ["calzone"],
  napolitaine: ["napolit", "napolet"],
  dessert: ["dessert", "dolce"],
  focaccia: ["focaccia"],
  pala: ["pala"],
  teglia: ["teglia"],
  doue: ["due", "duè", "doue", "doué", "ziolo"],
  pasta: ["pasta"],
  freestyle: ["freestyle", "free style"],
  rapidite: ["rapid", "veloce"],
  large: ["large", "xxl"],
};

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function ruleSlugForCategoryName(name: string): string | null {
  const normalized = normalize(name);
  const match = Object.entries(CATEGORY_RULE_MATCHERS).find(([, fragments]) =>
    fragments.some(fragment => normalized.includes(normalize(fragment)))
  );
  return match?.[0] ?? null;
}
