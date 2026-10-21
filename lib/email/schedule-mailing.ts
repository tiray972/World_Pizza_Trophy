// lib/email/schedule-mailing.ts
// Envoi à chaque participant de son programme de passage (catégorie, date,
// heure). Volontairement sobre : aucune mention de paiement, d'offre ou de
// statut — uniquement l'ordre de passage.

import nodemailer from "nodemailer";
import { adminDB } from "@/lib/firebase/admin";

/** Fuseau du concours : le serveur tourne en UTC, les heures doivent être françaises. */
export const EVENT_TIMEZONE = "Europe/Paris";

type Lang = "fr" | "en" | "es" | "it";

export interface Passage {
  date: string; // AAAA-MM-JJ
  start: Date;
  end: Date;
  category: string;
  teammates: string[];
}

export interface ScheduledPerson {
  firstName: string;
  lastName: string;
  passages: Passage[];
}

export interface ScheduleRecipient {
  email: string;
  greetingName: string;
  lang: Lang;
  people: ScheduledPerson[];
  /**
   * Vrai si l'adresse est celle du compte qui a inscrit les participants (et
   * non celle d'un participant) : l'email doit alors nommer chaque personne.
   */
  forBuyer: boolean;
}

export interface ScheduleAudience {
  eventName: string;
  recipients: ScheduleRecipient[];
  participantCount: number;
  /** Participants sans aucune adresse (ni la leur, ni celle de l'acheteur). */
  skipped: string[];
}

// ------------------------------------------------------------------ Langue

const TEXTS: Record<Lang, {
  subject: (event: string) => string;
  hello: (name: string) => string;
  intro: (event: string) => string;
  introForBuyer: (event: string) => string;
  date: string;
  time: string;
  category: string;
  with: string;
  account: string;
  questions: string;
  scheduleOf: (name: string) => string;
}> = {
  fr: {
    subject: event => `Votre programme de passage — ${event}`,
    hello: name => `Bonjour ${name},`,
    intro: event => `Voici votre programme de passage pour le ${event}.`,
    introForBuyer: event => `Voici le programme de passage des participants que vous avez inscrits au ${event}.`,
    date: "Date", time: "Horaire", category: "Catégorie", with: "avec",
    account: "Vous retrouvez ce programme à tout moment dans votre espace compte",
    questions: "Pour toute question, répondez simplement à cet email.",
    scheduleOf: name => `Programme de ${name}`,
  },
  en: {
    subject: event => `Your competition schedule — ${event}`,
    hello: name => `Hello ${name},`,
    intro: event => `Here is your competition schedule for the ${event}.`,
    introForBuyer: event => `Here is the competition schedule of the participants you registered for the ${event}.`,
    date: "Date", time: "Time", category: "Category", with: "with",
    account: "You can find this schedule at any time in your account",
    questions: "If you have any question, simply reply to this email.",
    scheduleOf: name => `Schedule for ${name}`,
  },
  es: {
    subject: event => `Tu horario de paso — ${event}`,
    hello: name => `Hola ${name}:`,
    intro: event => `Este es tu horario de paso para el ${event}.`,
    introForBuyer: event => `Este es el horario de paso de los participantes que inscribiste en el ${event}.`,
    date: "Fecha", time: "Horario", category: "Categoría", with: "con",
    account: "Puedes consultar este horario en cualquier momento en tu cuenta",
    questions: "Si tienes alguna pregunta, responde simplemente a este email.",
    scheduleOf: name => `Horario de ${name}`,
  },
  it: {
    subject: event => `Il tuo programma di gara — ${event}`,
    hello: name => `Ciao ${name},`,
    intro: event => `Ecco il tuo programma di gara per il ${event}.`,
    introForBuyer: event => `Ecco il programma di gara dei partecipanti che hai iscritto al ${event}.`,
    date: "Data", time: "Orario", category: "Categoria", with: "con",
    account: "Puoi ritrovare questo programma in qualsiasi momento nella tua area personale",
    questions: "Per qualsiasi domanda, rispondi semplicemente a questa email.",
    scheduleOf: name => `Programma di ${name}`,
  },
};

const LOCALES: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", es: "es-ES", it: "it-IT" };

/** Langue déduite du pays saisi par l'acheteur ; français par défaut. */
export function langFromCountry(country?: string): Lang {
  const value = (country || "").trim().toLowerCase();
  if (!value) return "fr";
  if (/^(it|ital)/.test(value)) return "it";
  if (/^(es|esp|spa)/.test(value)) return "es";
  if (/^(fr|fran)/.test(value) || /belg|suisse|switz|luxem|monaco|martiniq|guadel|réunion|reunion/.test(value)) return "fr";
  return "en";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDay(date: string, lang: Lang) {
  // Midi : évite tout glissement de jour lié au fuseau
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString(LOCALES[lang], {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: EVENT_TIMEZONE,
  });
  // Majuscule au jour seulement (« Mardi 27 octobre », pas « Octobre »)
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatHour(date: Date, lang: Lang) {
  return date.toLocaleTimeString(LOCALES[lang], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: EVENT_TIMEZONE,
  });
}

// ------------------------------------------------------- Construction des listes

const toDate = (value: unknown): Date => {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string);
};

/**
 * Destinataires et programmes de l'événement. Seuls les passages confirmés
 * (payés ou offerts) sont pris en compte ; un paiement en cours n'est pas
 * encore un passage.
 *
 * Chaque participant reçoit son programme à sa propre adresse. S'il n'en a
 * pas, le programme part au compte qui l'a inscrit (l'acheteur).
 */
export async function buildScheduleAudience(eventId: string): Promise<ScheduleAudience> {
  const [eventDoc, categoriesSnapshot, slotsSnapshot] = await Promise.all([
    adminDB.collection("events").doc(eventId).get(),
    adminDB.collection("categories").where("eventId", "==", eventId).get(),
    adminDB.collection("slots").where("eventId", "==", eventId).get(),
  ]);

  const eventData = eventDoc.data() || {};
  const eventName = `${eventData.name || "World Pizza Trophy"}${eventData.eventYear ? ` ${eventData.eventYear}` : ""}`;
  const categoryNames = new Map(categoriesSnapshot.docs.map(doc => [doc.id, String(doc.data().name || "")]));

  const confirmedSlots = slotsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Record<string, any>))
    .filter(slot => slot.status === "paid" || slot.status === "offered");

  // Comptes acheteurs (adresse de repli, prénom, pays)
  const buyerIds = Array.from(new Set(confirmedSlots.map(slot => slot.buyerId).filter(Boolean)));
  const buyerDocs = await Promise.all(buyerIds.map(id => adminDB.collection("users").doc(id).get()));
  const buyers = new Map(
    buyerDocs.filter(doc => doc.exists).map(doc => [doc.id, doc.data() as Record<string, any>])
  );

  const recipients = new Map<string, ScheduleRecipient>();
  const people = new Map<string, { recipientEmail: string; person: ScheduledPerson }>();
  const skipped = new Set<string>();

  for (const slot of confirmedSlots) {
    const participants: Record<string, any>[] =
      Array.isArray(slot.participants) && slot.participants.length > 0
        ? slot.participants
        : slot.participant
          ? [slot.participant]
          : [];

    const buyer = slot.buyerId ? buyers.get(slot.buyerId) : undefined;

    for (const participant of participants) {
      const firstName = String(participant.firstName || "").trim();
      const lastName = String(participant.lastName || "").trim();
      if (!firstName && !lastName) continue;

      const email = String(participant.email || buyer?.email || "").trim().toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      if (!email || !email.includes("@")) {
        skipped.add(fullName);
        continue;
      }

      const isOwnAddress = !!participant.email;
      if (!recipients.has(email)) {
        recipients.set(email, {
          email,
          greetingName: isOwnAddress ? firstName : String(buyer?.firstName || firstName),
          lang: langFromCountry(buyer?.country),
          people: [],
          forBuyer: !isOwnAddress,
        });
      } else if (isOwnAddress && recipients.get(email)!.forBuyer) {
        // L'adresse appartient aussi à un participant : on le salue lui
        const recipient = recipients.get(email)!;
        recipient.forBuyer = false;
        recipient.greetingName = firstName;
      }

      const personKey = `${email}|${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
      if (!people.has(personKey)) {
        const person: ScheduledPerson = { firstName, lastName, passages: [] };
        people.set(personKey, { recipientEmail: email, person });
        recipients.get(email)!.people.push(person);
      }

      const teammates = participants
        .filter(other => other !== participant)
        .map(other => `${other.firstName || ""} ${other.lastName || ""}`.trim())
        .filter(Boolean);

      people.get(personKey)!.person.passages.push({
        date: String(slot.date || ""),
        start: toDate(slot.startTime),
        end: toDate(slot.endTime),
        category: categoryNames.get(slot.categoryId) || "",
        teammates,
      });
    }
  }

  for (const recipient of recipients.values()) {
    for (const person of recipient.people) {
      person.passages.sort((a, b) => a.start.getTime() - b.start.getTime());
    }
  }

  return {
    eventName,
    // Ordre stable : indispensable pour envoyer par lots sans doublon ni oubli
    recipients: Array.from(recipients.values()).sort((a, b) => a.email.localeCompare(b.email)),
    participantCount: people.size,
    skipped: Array.from(skipped).sort(),
  };
}

// ------------------------------------------------------------------ Email

export function renderScheduleEmail(
  recipient: ScheduleRecipient,
  eventName: string,
  accountUrl: string
): { subject: string; html: string; text: string } {
  const t = TEXTS[recipient.lang];
  // On nomme chaque personne dès qu'il y en a plusieurs, ou que l'email part au
  // compte qui les a inscrites : sinon « votre programme » serait trompeur.
  const severalPeople = recipient.people.length > 1 || recipient.forBuyer;
  const intro = recipient.forBuyer ? t.introForBuyer(eventName) : t.intro(eventName);

  const sections = recipient.people
    .map(person => {
      const rows = person.passages
        .map(
          passage => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;">${escapeHtml(formatDay(passage.date, recipient.lang))}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:bold;white-space:nowrap;">${formatHour(passage.start, recipient.lang)} – ${formatHour(passage.end, recipient.lang)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;">${escapeHtml(passage.category)}${
              passage.teammates.length
                ? `<br><span style="color:#666;font-size:12px;">${t.with} ${escapeHtml(passage.teammates.join(", "))}</span>`
                : ""
            }</td>
          </tr>`
        )
        .join("");

      return `
        ${severalPeople ? `<h3 style="margin:24px 0 8px;color:#8B0000;font-size:16px;">${escapeHtml(t.scheduleOf(`${person.firstName} ${person.lastName}`))}</h3>` : ""}
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
          <thead>
            <tr style="background:#8B0000;color:#fff;text-align:left;">
              <th style="padding:10px 12px;">${t.date}</th>
              <th style="padding:10px 12px;">${t.time}</th>
              <th style="padding:10px 12px;">${t.category}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    })
    .join("");

  // Document complet avec son encodage : les accents restent intacts même dans
  // les messageries qui ignorent l'en-tête Content-Type.
  const html = `<!DOCTYPE html>
<html lang="${recipient.lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:16px;background:#f6f6f6;">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#222;background:#fff;border-radius:8px;">
    <div style="background:#8B0000;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:20px;">🍕 ${escapeHtml(eventName)}</h1>
    </div>
    <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">
      <p style="margin-top:0;">${escapeHtml(t.hello(recipient.greetingName))}</p>
      <p>${escapeHtml(intro)}</p>
      ${sections}
      <p style="margin-top:24px;">${t.account} : <a href="${accountUrl}" style="color:#8B0000;">${accountUrl}</a></p>
      <p style="color:#666;font-size:13px;">${t.questions}</p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    t.hello(recipient.greetingName),
    "",
    intro,
    "",
    ...recipient.people.flatMap(person => [
      ...(severalPeople ? [t.scheduleOf(`${person.firstName} ${person.lastName}`)] : []),
      ...person.passages.map(
        passage =>
          `- ${formatDay(passage.date, recipient.lang)} · ${formatHour(passage.start, recipient.lang)}–${formatHour(passage.end, recipient.lang)} · ${passage.category}${
            passage.teammates.length ? ` (${t.with} ${passage.teammates.join(", ")})` : ""
          }`
      ),
      "",
    ]),
    `${t.account} : ${accountUrl}`,
    t.questions,
  ].join("\n");

  return { subject: t.subject(eventName), html, text };
}

export function createMailTransport() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("L'envoi d'emails n'est pas configuré (SMTP_USER / SMTP_PASS manquants sur le serveur).");
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export const SCHEDULE_SENDER = () => `"World Pizza Trophy" <${process.env.SMTP_USER}>`;
