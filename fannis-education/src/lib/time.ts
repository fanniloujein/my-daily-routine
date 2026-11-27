/**
 * Utilitaires de date dans le fuseau de la plateforme (Africa/Tunis).
 * Les dates sont stockées en UTC ; les disponibilités des enseignants sont exprimées
 * en minutes locales. Aucune dépendance externe : on s'appuie sur Intl.
 */
export const PLATFORM_TZ = "Africa/Tunis";

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number; // 0 = dimanche
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, tz = PLATFORM_TZ): ZonedParts {
  const parts = Object.fromEntries(partsFormatter(tz).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    dayOfWeek: WEEKDAYS[parts.weekday as string],
  };
}

/** Décalage (minutes) du fuseau par rapport à UTC à l'instant donné. */
export function tzOffsetMinutes(date: Date, tz = PLATFORM_TZ): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** "YYYY-MM-DD" + minutes locales → instant UTC. */
export function zonedTimeToUtc(isoDate: string, minuteOfDay: number, tz = PLATFORM_TZ): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, minuteOfDay));
  const offset = tzOffsetMinutes(guess, tz);
  const result = new Date(guess.getTime() - offset * 60000);
  // Correction si le décalage diffère à l'instant réel (changement d'heure).
  const offset2 = tzOffsetMinutes(result, tz);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60000);
}

/** Date locale "YYYY-MM-DD" d'un instant. */
export function toLocalIsoDate(date: Date, tz = PLATFORM_TZ): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Jour de la semaine (0 = dimanche) d'une date "YYYY-MM-DD" (calendrier, indépendant du fuseau). */
export function dayOfWeekOf(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function minutesToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function hhmmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null;
  return h * 60 + mi;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function intlLocale(locale: string) {
  return locale === "ar" ? "ar-TN-u-nu-latn" : "fr-FR";
}

export function formatDate(date: Date, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: PLATFORM_TZ, ...opts }).format(date);
}

export function formatDateTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: PLATFORM_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: PLATFORM_TZ, hour: "2-digit", minute: "2-digit" }).format(date);
}
