// Utilitaires de dates « calendrier » : on manipule des chaînes YYYY-MM-DD et HH:mm
// en heure locale, sans conversion de fuseau horaire.

export type DateStr = string; // YYYY-MM-DD
export type TimeStr = string; // HH:mm

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(s: DateStr): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0); // midi : évite les soucis de changement d'heure
}

export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDate(s);
  return toDateStr(d) === s;
}

export function isValidTimeStr(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/**
 * Date/heure « murale » actuelle. Côté serveur, APP_TIMEZONE (ex. Europe/Paris) permet
 * d'utiliser le fuseau de l'utilisatrice même si le serveur tourne en UTC.
 */
function nowParts(): { date: DateStr; time: TimeStr } {
  const tz = typeof process !== "undefined" ? process.env.APP_TIMEZONE : undefined;
  const d = new Date();
  if (!tz) return { date: toDateStr(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function today(): DateStr {
  return nowParts().date;
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function diffDays(a: DateStr, b: DateStr): number {
  // a - b en jours
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86_400_000);
}

export function weekday(s: DateStr): number {
  return parseDate(s).getDay(); // 0 = dimanche
}

/** Lundi de la semaine contenant s */
export function startOfWeek(s: DateStr): DateStr {
  const wd = weekday(s);
  return addDays(s, wd === 0 ? -6 : 1 - wd);
}

export function startOfMonth(s: DateStr): DateStr {
  return s.slice(0, 8) + "01";
}

export function endOfMonth(s: DateStr): DateStr {
  const d = parseDate(startOfMonth(s));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toDateStr(d);
}

export function addMonths(s: DateStr, n: number): DateStr {
  const d = parseDate(startOfMonth(s));
  d.setMonth(d.getMonth() + n);
  return toDateStr(d);
}

export function rangeDays(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function timeToMin(t: TimeStr): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minToTime(m: number): TimeStr {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(m)));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

export function nowTime(): TimeStr {
  return nowParts().time;
}

/** Minutes écoulées entre maintenant (heure murale) et une date/heure locale donnée. */
export function minutesUntil(date: DateStr, time: TimeStr): number {
  const n = nowParts();
  return diffDays(date, n.date) * 1440 + timeToMin(time) - timeToMin(n.time);
}

export function addMinutesToTime(t: TimeStr, n: number): TimeStr {
  return minToTime(timeToMin(t) + n);
}

/** Durée formatée en français : 90 → « 1 h 30 » */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${pad(m)}` : `${h} h`;
}

/** 17:00 → « 17 h », 09:30 → « 9 h 30 » */
export function formatTime(t?: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return m ? `${h} h ${pad(m)}` : `${h} h`;
}

/** Combine une date et une heure locales en objet Date */
export function toDateTime(date: DateStr, time: TimeStr): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

/** Arrondit une heure au multiple supérieur de `step` minutes (19:23 → 19:30 pour 15). */
export function roundUpTime(t: TimeStr, step = 15): TimeStr {
  return minToTime(Math.ceil(timeToMin(t) / step) * step);
}
