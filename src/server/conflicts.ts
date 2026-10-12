import { prisma } from "@/lib/db";
import { overlaps } from "@/lib/conflicts";
import { addDays, timeToMin, type DateStr } from "@/lib/dates";
import { expandDates, type RecurrenceRule } from "@/lib/recurrence";
import { getOccurrences } from "./occurrences";
import { findSlot } from "./scheduling";

/** Conflits d'une activité (et de ses 4 prochaines semaines si récurrente) avec l'agenda existant. */
export async function checkConflicts(
  userId: string,
  a: { date: DateStr; startTime: string | null; endTime: string | null; durationMin: number } & Partial<RecurrenceRule>,
  excludeId?: string,
) {
  if (!a.startTime || !a.endTime) return { conflicts: [], suggestion: null };
  const rule: RecurrenceRule = { date: a.date, recurrence: a.recurrence ?? "NONE", interval: a.interval ?? 1, weekdays: a.weekdays ?? [], until: a.until };
  const dates = expandDates(rule, a.date, addDays(a.date, rule.recurrence === "NONE" ? 0 : 27));
  if (!dates.length) return { conflicts: [], suggestion: null };
  const occ = await getOccurrences(userId, dates[0], dates[dates.length - 1]);
  const conflicts = occ
    .filter((o) => o.id !== excludeId && dates.includes(o.date) && o.status !== "DONE" && o.status !== "POSTPONED")
    .filter((o) => overlaps(o, { id: "new", title: "", startTime: a.startTime, endTime: a.endTime }))
    .map((o) => ({ id: o.id, title: o.title, date: o.date, startTime: o.startTime, endTime: o.endTime, isFixed: o.isFixed }));
  let suggestion = null;
  if (conflicts.length) {
    const duration = timeToMin(a.endTime) - timeToMin(a.startTime);
    // D'abord après l'horaire demandé, sinon plus tôt dans la journée, sinon les jours suivants
    suggestion =
      (await findSlot(userId, { from: a.date, to: a.date, duration, after: { date: a.date, time: a.startTime } })) ??
      (await findSlot(userId, { from: a.date, to: addDays(a.date, 2), duration }));
  }
  return { conflicts, suggestion };
}

export async function categoryOwned(userId: string, categoryId: string) {
  return !!(await prisma.category.findFirst({ where: { id: categoryId, userId } }));
}
