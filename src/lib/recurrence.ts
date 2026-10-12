import { addDays, diffDays, weekday, type DateStr } from "./dates";

export type RecurrenceRule = {
  date: DateStr; // première occurrence
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "CUSTOM";
  interval: number;
  weekdays: number[];
  until?: string | null;
};

/**
 * Indique si une règle de récurrence produit une occurrence à la date donnée.
 * - DAILY : tous les `interval` jours.
 * - WEEKLY : toutes les `interval` semaines, le(s) jour(s) `weekdays` (par défaut le jour de la 1re occurrence).
 * - CUSTOM : jours de la semaine choisis, chaque semaine (interval semaines).
 */
export function occursOn(rule: RecurrenceRule, d: DateStr): boolean {
  if (d < rule.date) return false;
  if (rule.until && d > rule.until) return false;
  const interval = Math.max(1, rule.interval || 1);
  switch (rule.recurrence) {
    case "NONE":
      return d === rule.date;
    case "DAILY":
      return diffDays(d, rule.date) % interval === 0;
    case "WEEKLY":
    case "CUSTOM": {
      const days = rule.weekdays.length ? rule.weekdays : [weekday(rule.date)];
      if (!days.includes(weekday(d))) return false;
      // Nombre de semaines (lundi→dimanche) écoulées depuis la semaine de départ
      const startMonday = addDays(rule.date, -((weekday(rule.date) + 6) % 7));
      const dMonday = addDays(d, -((weekday(d) + 6) % 7));
      const weeks = Math.round(diffDays(dMonday, startMonday) / 7);
      return weeks % interval === 0;
    }
  }
}

/** Liste les dates d'occurrence comprises entre from et to (inclus). */
export function expandDates(rule: RecurrenceRule, from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  if (rule.recurrence === "NONE") {
    if (rule.date >= from && rule.date <= to) out.push(rule.date);
    return out;
  }
  const start = rule.date > from ? rule.date : from;
  const end = rule.until && rule.until < to ? rule.until : to;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (occursOn(rule, d)) out.push(d);
    if (out.length > 1000) break; // garde-fou
  }
  return out;
}

export function describeRecurrence(rule: RecurrenceRule): string {
  const names = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const n = Math.max(1, rule.interval || 1);
  switch (rule.recurrence) {
    case "NONE":
      return "Unique";
    case "DAILY":
      return n === 1 ? "Tous les jours" : `Tous les ${n} jours`;
    case "WEEKLY":
    case "CUSTOM": {
      const days = (rule.weekdays.length ? rule.weekdays : [weekday(rule.date)])
        .slice()
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((w) => names[w])
        .join(", ");
      return n === 1 ? `Chaque semaine (${days})` : `Toutes les ${n} semaines (${days})`;
    }
  }
}
