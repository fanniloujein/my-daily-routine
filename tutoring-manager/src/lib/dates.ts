// Dates « calendrier » (YYYY-MM-DD) et heures (HH:mm) dans le fuseau de l'activité.
// Toutes les fonctions sont pures et indépendantes du fuseau du serveur.

export const TIMEZONE = process.env.APP_TIMEZONE || process.env.NEXT_PUBLIC_APP_TIMEZONE || "Africa/Tunis";

const pad = (n: number) => String(n).padStart(2, "0");

/** Date et heure actuelles dans le fuseau de l'activité. */
export function nowParts(tz = TIMEZONE, at = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export const today = (tz = TIMEZONE) => nowParts(tz).date;

function toUTC(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromUTC(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: string, n: number) {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

/** 1 = lundi … 7 = dimanche */
export function weekday(date: string) {
  const w = toUTC(date).getUTCDay();
  return w === 0 ? 7 : w;
}

export function startOfWeek(date: string) {
  return addDays(date, 1 - weekday(date));
}

export function monthOf(date: string) {
  return date.slice(0, 7);
}

export function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: string) {
  const [y, m] = date.split("-").map(Number);
  return fromUTC(new Date(Date.UTC(y, m, 0)));
}

export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function daysBetween(a: string, b: string) {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86400000);
}

export function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function duration(start: string, end: string) {
  return toMinutes(end) - toMinutes(start);
}

export function rangeDates(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const dayName = (date: string) => DAYS[weekday(date) - 1];
export const weekdayName = (w: number) => DAYS[w - 1];

/** « samedi 21 novembre 2026 » */
export function longDate(date: string, withYear = true) {
  const [y, m, d] = date.split("-").map(Number);
  return `${dayName(date)} ${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** « 21/11/2026 » */
export function shortDate(date: string | null | undefined) {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${cap(MONTHS[m - 1])} ${y}`;
}

const SHORT_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function shortMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${SHORT_MONTHS[m - 1]} ${String(y).slice(2)}`;
}

export function formatMinutes(min: number) {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${pad(m)}` : `${h} h`;
}

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUTC(s).getTime()) && fromUTC(toUTC(s)) === s;
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
