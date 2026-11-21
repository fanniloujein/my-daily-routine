// Planning : chevauchements, créneaux libres, récurrences, charge de travail (fonctions pures).
import { addDays, rangeDates, toMinutes, fromMinutes, weekday } from "./dates";

export type Block = { id?: string; date: string; startTime: string; endTime: string; kind?: string; label?: string };

export const overlaps = (a: Block, b: Block) =>
  a.date === b.date && toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);

/** Blocs qui chevauchent `slot` (en ignorant l'élément lui-même). */
export function findConflicts<T extends Block>(slot: Block, blocks: T[]): T[] {
  return blocks.filter((b) => (!slot.id || b.id !== slot.id) && overlaps(slot, b));
}

/** Dates générées par une récurrence hebdomadaire (jours 1..7), bornes incluses. Max 200 occurrences. */
export function weeklyDates(start: string, weekdays: number[], until: string, max = 200): string[] {
  const days = new Set(weekdays);
  const out: string[] = [];
  for (let d = start; d <= until && out.length < max; d = addDays(d, 1)) if (days.has(weekday(d))) out.push(d);
  return out;
}

/** Développe les événements répétés chaque semaine (weeklyUntil) sur une période. */
export function expandWeekly<T extends Block & { weeklyUntil?: string | null }>(items: T[], from: string, to: string): (T & { occurrence: string })[] {
  const out: (T & { occurrence: string })[] = [];
  for (const it of items) {
    if (!it.weeklyUntil) {
      if (it.date >= from && it.date <= to) out.push({ ...it, occurrence: it.date });
      continue;
    }
    const end = it.weeklyUntil < to ? it.weeklyUntil : to;
    let d = it.date;
    while (d < from) d = addDays(d, 7);
    for (; d <= end; d = addDays(d, 7)) out.push({ ...it, date: d, occurrence: d });
  }
  return out;
}

/** Créneaux libres d'une journée entre dayStart et dayEnd, d'au moins `minMinutes`. */
export function freeSlots(date: string, busy: Block[], dayStart: string, dayEnd: string, minMinutes = 30) {
  const segs = busy
    .filter((b) => b.date === date)
    .map((b) => [toMinutes(b.startTime), toMinutes(b.endTime)] as const)
    .sort((a, b) => a[0] - b[0]);
  const out: { startTime: string; endTime: string; minutes: number }[] = [];
  let cur = toMinutes(dayStart);
  const end = toMinutes(dayEnd);
  for (const [s, e] of segs) {
    if (s - cur >= minMinutes) out.push({ startTime: fromMinutes(cur), endTime: fromMinutes(Math.min(s, end)), minutes: Math.min(s, end) - cur });
    cur = Math.max(cur, e);
    if (cur >= end) break;
  }
  if (end - cur >= minMinutes) out.push({ startTime: fromMinutes(cur), endTime: fromMinutes(end), minutes: end - cur });
  return out.filter((s) => s.minutes >= minMinutes);
}

/** Prochain créneau libre d'une durée donnée, à partir d'une date, dans les heures de travail. */
export function nextFreeSlot(fromDate: string, minutes: number, busy: Block[], dayStart: string, dayEnd: string, days = 14) {
  for (const d of rangeDates(fromDate, addDays(fromDate, days))) {
    const s = freeSlots(d, busy, dayStart, dayEnd, minutes)[0];
    if (s) return { date: d, startTime: s.startTime, endTime: fromMinutes(toMinutes(s.startTime) + minutes) };
  }
  return null;
}

/** Minutes occupées dans la journée (chevauchements fusionnés). */
export function busyMinutes(date: string, blocks: Block[]) {
  const segs = blocks.filter((b) => b.date === date).map((b) => [toMinutes(b.startTime), toMinutes(b.endTime)]).sort((a, b) => a[0] - b[0]);
  let total = 0, cs = -1, ce = -1;
  for (const [s, e] of segs) {
    if (s > ce) {
      if (ce > cs) total += ce - cs;
      cs = s; ce = e;
    } else ce = Math.max(ce, e);
  }
  if (ce > cs) total += ce - cs;
  return total;
}

/** Charge de travail : léger / normal / chargé / surchargé selon le maximum quotidien souhaité. */
export function loadLevel(workMinutes: number, maxDailyHours: number): "LIGHT" | "NORMAL" | "BUSY" | "OVERLOADED" {
  const r = workMinutes / (maxDailyHours * 60);
  if (r > 1) return "OVERLOADED";
  if (r >= 0.8) return "BUSY";
  if (r >= 0.35) return "NORMAL";
  return "LIGHT";
}

export const LOAD_LABELS = { LIGHT: "Légère", NORMAL: "Équilibrée", BUSY: "Chargée", OVERLOADED: "Surchargée" } as const;

/** Pauses suggérées entre deux séances consécutives trop rapprochées. */
export function breakSuggestions(blocks: Block[], breakMinutes: number) {
  const sorted = [...blocks].sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? -1 : 1));
  const out: { date: string; after: string; gap: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    if (a.date !== b.date) continue;
    const gap = toMinutes(b.startTime) - toMinutes(a.endTime);
    if (gap >= 0 && gap < breakMinutes) out.push({ date: a.date, after: a.endTime, gap });
  }
  return out;
}
