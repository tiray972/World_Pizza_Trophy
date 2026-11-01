// lib/domain/timezone.ts
// Heures « murales » d'un fuseau (Europe/Paris par défaut), sans dépendance.
// Recopier un créneau d'une édition à l'autre garde l'heure locale (11 h 15 reste
// 11 h 15), même si l'une des dates est à l'heure d'été et l'autre à l'heure d'hiver.

export const EVENT_TIMEZONE = "Europe/Paris";

function parts(date: Date, timeZone: string) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(formatted.find(part => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Date (AAAA-MM-JJ) et heure locales d'un instant. */
export function wallTime(date: Date, timeZone = EVENT_TIMEZONE): { date: string; hour: number; minute: number } {
  const p = parts(date, timeZone);
  return { date: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`, hour: p.hour, minute: p.minute };
}

/** Instant correspondant à une date et une heure locales du fuseau. */
export function instantFromWallTime(date: string, hour: number, minute: number, timeZone = EVENT_TIMEZONE): Date {
  const [year, month, day] = date.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Décalage du fuseau à cet instant, recalculé une fois pour les changements d'heure.
  const offsetAt = (instant: number) => {
    const p = parts(new Date(instant), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant;
  };
  let instant = guess - offsetAt(guess);
  instant = guess - offsetAt(instant);
  return new Date(instant);
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
