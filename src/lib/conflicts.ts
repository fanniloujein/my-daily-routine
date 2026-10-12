import { timeToMin, minToTime, type TimeStr } from "./dates";

export type TimedItem = { id: string; title: string; startTime?: string | null; endTime?: string | null };

export function overlaps(a: TimedItem, b: TimedItem): boolean {
  if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false;
  return timeToMin(a.startTime) < timeToMin(b.endTime) && timeToMin(b.startTime) < timeToMin(a.endTime);
}

/** Toutes les paires d'éléments qui se chevauchent dans une même journée. */
export function findConflicts<T extends TimedItem>(items: T[]): [T, T][] {
  const timed = items
    .filter((i) => i.startTime && i.endTime)
    .sort((a, b) => timeToMin(a.startTime!) - timeToMin(b.startTime!));
  const out: [T, T][] = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      if (timeToMin(timed[j].startTime!) >= timeToMin(timed[i].endTime!)) break;
      out.push([timed[i], timed[j]]);
    }
  }
  return out;
}

export type Slot = { start: number; end: number }; // minutes depuis minuit

/**
 * Créneaux libres de la journée, en tenant compte des éléments déjà placés
 * et d'une marge (pause) autour de chacun.
 */
export function freeSlots(
  busy: TimedItem[],
  dayStart: TimeStr,
  dayEnd: TimeStr,
  bufferMin = 0,
  notBefore?: TimeStr,
): Slot[] {
  let cursor = timeToMin(dayStart);
  if (notBefore) cursor = Math.max(cursor, timeToMin(notBefore));
  const end = timeToMin(dayEnd);
  const blocks = busy
    .filter((b) => b.startTime && b.endTime)
    .map((b) => ({ start: timeToMin(b.startTime!) - bufferMin, end: timeToMin(b.endTime!) + bufferMin }))
    .sort((a, b) => a.start - b.start);
  const slots: Slot[] = [];
  for (const b of blocks) {
    if (b.start > cursor) slots.push({ start: cursor, end: Math.min(b.start, end) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= end) break;
  }
  if (cursor < end) slots.push({ start: cursor, end });
  return slots.filter((s) => s.end - s.start > 0);
}

/** Premier créneau libre d'au moins `duration` minutes. */
export function findNextFreeSlot(
  busy: TimedItem[],
  duration: number,
  dayStart: TimeStr,
  dayEnd: TimeStr,
  bufferMin = 10,
  notBefore?: TimeStr,
): { startTime: TimeStr; endTime: TimeStr } | null {
  for (const s of freeSlots(busy, dayStart, dayEnd, bufferMin, notBefore)) {
    if (s.end - s.start >= duration) {
      return { startTime: minToTime(s.start), endTime: minToTime(s.start + duration) };
    }
  }
  return null;
}
