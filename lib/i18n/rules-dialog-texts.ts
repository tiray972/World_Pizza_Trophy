// lib/i18n/rules-dialog-texts.ts
// Libellés de la fenêtre « Règlement de la catégorie » du Booking.
// Seule l'interface est traduite ici : le contenu du règlement vient de la base
// (catégorie → version publiée), jamais de ce fichier.

export type RulesDialogLang = "fr" | "en" | "es" | "it";

export const RULES_DIALOG_TEXTS = {
  fr: {
    title: "Règlement — {category}",
    intro: "Avant de choisir votre créneau, lisez le règlement de cette catégorie.",
    version: "Version {version}, publiée le {date}",
    checkbox: "J’ai lu et j’accepte le règlement de cette catégorie.",
    accept: "Accepter et choisir mon créneau",
    cancel: "Retour",
    close: "Fermer sans accepter",
    actorNotice:
      "Vous acceptez ce règlement en tant que responsable de cette inscription, pour vous-même ou pour les concurrents que vous inscrivez. Cette acceptation n’atteste pas que chaque concurrent l’a lu personnellement : pensez à le leur transmettre.",
    teamNotice: "Catégorie en équipe : transmettez ce règlement à chaque équipier.",
    fallback: "Ce règlement n’est pas encore disponible en {requested}. Le texte officiel ci-dessous est en {displayed}.",
    notPublished: "Le règlement de cette catégorie n’est pas encore publié : les réservations ouvriront dès sa publication.",
    unavailableBadge: "Règlement à venir",
    acceptedBadge: "Règlement accepté",
    reread: "Relire le règlement",
    outdated:
      "Le règlement de {categories} a changé ou doit être accepté. Votre panier est conservé : rouvrez la catégorie pour lire et accepter la version en vigueur.",
    langs: { fr: "français", en: "anglais", es: "espagnol", it: "italien" },
  },
  en: {
    title: "Rules — {category}",
    intro: "Before choosing your time slot, please read the rules of this category.",
    version: "Version {version}, published on {date}",
    checkbox: "I have read and accept the rules of this category.",
    accept: "Accept and choose my time slot",
    cancel: "Back",
    close: "Close without accepting",
    actorNotice:
      "You accept these rules as the person responsible for this registration, for yourself or for the competitors you register. This acceptance does not certify that each competitor has read them personally: please share them with them.",
    teamNotice: "Team category: please share these rules with each team member.",
    fallback: "These rules are not available in {requested} yet. The official text below is in {displayed}.",
    notPublished: "The rules of this category have not been published yet: booking will open as soon as they are.",
    unavailableBadge: "Rules coming soon",
    acceptedBadge: "Rules accepted",
    reread: "Read the rules again",
    outdated:
      "The rules of {categories} have changed or must be accepted. Your cart is kept: reopen the category to read and accept the current version.",
    langs: { fr: "French", en: "English", es: "Spanish", it: "Italian" },
  },
  es: {
    title: "Reglamento — {category}",
    intro: "Antes de elegir tu horario, lee el reglamento de esta categoría.",
    version: "Versión {version}, publicada el {date}",
    checkbox: "He leído y acepto el reglamento de esta categoría.",
    accept: "Aceptar y elegir mi horario",
    cancel: "Volver",
    close: "Cerrar sin aceptar",
    actorNotice:
      "Aceptas este reglamento como responsable de esta inscripción, para ti o para los competidores que inscribes. Esta aceptación no certifica que cada competidor lo haya leído personalmente: compártelo con ellos.",
    teamNotice: "Categoría por equipos: comparte este reglamento con cada miembro del equipo.",
    fallback: "Este reglamento aún no está disponible en {requested}. El texto oficial a continuación está en {displayed}.",
    notPublished: "El reglamento de esta categoría aún no se ha publicado: las reservas se abrirán en cuanto se publique.",
    unavailableBadge: "Reglamento próximamente",
    acceptedBadge: "Reglamento aceptado",
    reread: "Volver a leer el reglamento",
    outdated:
      "El reglamento de {categories} ha cambiado o debe aceptarse. Tu carrito se conserva: vuelve a abrir la categoría para leer y aceptar la versión vigente.",
    langs: { fr: "francés", en: "inglés", es: "español", it: "italiano" },
  },
  it: {
    title: "Regolamento — {category}",
    intro: "Prima di scegliere il tuo orario, leggi il regolamento di questa categoria.",
    version: "Versione {version}, pubblicata il {date}",
    checkbox: "Ho letto e accetto il regolamento di questa categoria.",
    accept: "Accetta e scegli il mio orario",
    cancel: "Indietro",
    close: "Chiudi senza accettare",
    actorNotice:
      "Accetti questo regolamento come responsabile di questa iscrizione, per te o per i concorrenti che iscrivi. Questa accettazione non attesta che ogni concorrente lo abbia letto personalmente: condividilo con loro.",
    teamNotice: "Categoria a squadre: condividi questo regolamento con ogni componente della squadra.",
    fallback: "Questo regolamento non è ancora disponibile in {requested}. Il testo ufficiale qui sotto è in {displayed}.",
    notPublished: "Il regolamento di questa categoria non è ancora pubblicato: le prenotazioni apriranno appena sarà pubblicato.",
    unavailableBadge: "Regolamento in arrivo",
    acceptedBadge: "Regolamento accettato",
    reread: "Rileggi il regolamento",
    outdated:
      "Il regolamento di {categories} è cambiato o deve essere accettato. Il carrello è conservato: riapri la categoria per leggere e accettare la versione in vigore.",
    langs: { fr: "francese", en: "inglese", es: "spagnolo", it: "italiano" },
  },
} as const;

export function rulesDialogTexts(lang: string) {
  return RULES_DIALOG_TEXTS[(lang in RULES_DIALOG_TEXTS ? lang : "fr") as RulesDialogLang];
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}
