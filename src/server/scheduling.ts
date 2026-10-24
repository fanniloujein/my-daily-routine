import { prisma } from "@/lib/db";
import { findNextFreeSlot, type TimedItem } from "@/lib/conflicts";
import { addDays, nowTime, roundUpTime, today, type DateStr } from "@/lib/dates";
import { getOccurrences } from "./occurrences";
import { readSettings } from "@/lib/validation";

/**
 * Cherche un vrai créneau libre (agenda réel, pauses incluses) sur une plage de jours.
 * Ne renvoie jamais un créneau qui chevauche une activité existante.
 */
export async function findSlot(
  userId: string,
  opts: { from: DateStr; to: DateStr; duration: number; workOnly?: boolean; before?: { date: DateStr; time: string }; after?: { date: DateStr; time: string } },
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const s = readSettings(user.settings);
  const occ = await getOccurrences(userId, opts.from, opts.to);
  const t = today();
  for (let d = opts.from; d <= opts.to; d = addDays(d, 1)) {
    if (d < t) continue;
    const busy: TimedItem[] = occ.filter((o) => o.date === d && o.status !== "DONE" && o.status !== "POSTPONED");
    if (s.lunchStart && s.lunchEnd) busy.push({ id: "lunch", title: "Déjeuner", startTime: s.lunchStart, endTime: s.lunchEnd });
    let end = opts.workOnly ? s.workEnd : s.dayEnd;
    if (opts.before && opts.before.date === d && opts.before.time < end) end = opts.before.time;
    let notBefore = d === t ? roundUpTime(nowTime()) : undefined;
    if (opts.after && opts.after.date === d && (!notBefore || opts.after.time > notBefore)) notBefore = opts.after.time;
    const slot = findNextFreeSlot(busy, opts.duration, s.dayStart, end, s.breakMin, notBefore);
    if (slot) return { date: d, ...slot };
  }
  return null;
}
