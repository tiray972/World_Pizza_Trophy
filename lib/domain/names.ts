// lib/domain/names.ts
// Noms des participants : affichage « NOM Prénom » et clés de comparaison.
//
// ⚠️ Les clés servent à retrouver une saisie identique, jamais à fusionner
// deux personnes : `strictNameKey` ne gomme que la casse et les espaces ;
// `looseNameKey` (accents ignorés) ne sert qu'à signaler de possibles doublons
// à un administrateur.

/** Retire les espaces en trop (début, fin, espaces multiples, insécables). */
export function normalizeSpaces(value: string | null | undefined): string {
  return (value ?? "").replace(/[\s  ]+/g, " ").trim();
}

/** NOM en majuscules, accents, apostrophes et traits d'union conservés. */
export function formatLastName(value: string | null | undefined): string {
  return normalizeSpaces(value).toLocaleUpperCase("fr-FR");
}

function capitalizeWord(word: string): string {
  if (!word) return word;
  const lower = word.toLocaleLowerCase("fr-FR");
  return lower.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1);
}

/**
 * Prénom avec une casse correcte. Une saisie déjà en casse mixte
 * (« Anne-Sophie », « DeAndre ») est respectée ; seules les saisies tout en
 * majuscules ou tout en minuscules sont reformatées.
 */
export function formatFirstName(value: string | null | undefined): string {
  const cleaned = normalizeSpaces(value);
  const isUniformCase =
    cleaned === cleaned.toLocaleUpperCase("fr-FR") || cleaned === cleaned.toLocaleLowerCase("fr-FR");
  if (!isUniformCase) return cleaned;
  // Découpe en conservant les séparateurs : espace, trait d'union, apostrophes.
  return cleaned
    .split(/([ \-'’])/)
    .map(part => (/^[ \-'’]$/.test(part) ? part : capitalizeWord(part)))
    .join("");
}

export interface PersonName {
  firstName: string;
  lastName: string;
}

/** Nom canonique d'une saisie (création de participant). */
export function canonicalName(input: Partial<PersonName>): PersonName {
  return {
    firstName: formatFirstName(input.firstName),
    lastName: formatLastName(input.lastName),
  };
}

/** « NOM Prénom » pour les listes, exports et feuilles de présence. */
export function displayName(person: Partial<PersonName> | null | undefined): string {
  if (!person) return "";
  return [formatLastName(person.lastName), formatFirstName(person.firstName)].filter(Boolean).join(" ");
}

/** Saisie identique à la casse et aux espaces près (accents conservés). */
export function strictNameKey(person: Partial<PersonName>): string {
  return `${normalizeSpaces(person.lastName).toLocaleLowerCase("fr-FR")}|${normalizeSpaces(person.firstName).toLocaleLowerCase("fr-FR")}`;
}

/** Clé tolérante (sans accents) : uniquement pour signaler des doublons possibles. */
export function looseNameKey(person: Partial<PersonName>): string {
  return strictNameKey(person).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function isNameComplete(person: Partial<PersonName> | null | undefined): boolean {
  return !!normalizeSpaces(person?.firstName) && !!normalizeSpaces(person?.lastName);
}
