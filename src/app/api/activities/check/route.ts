import { z } from "zod";
import { body, route } from "@/lib/api";
import { dateStr, timeStr } from "@/lib/validation";
import { addDays, addMinutesToTime } from "@/lib/dates";
import { checkConflicts } from "@/server/conflicts";
import { findSlot } from "@/server/scheduling";

const schema = z.object({
  date: dateStr,
  startTime: timeStr.nullable().optional(),
  durationMin: z.number().int().min(5).max(1440),
  excludeId: z.string().optional(),
});

/** Vérifie un horaire et propose le prochain créneau libre réel. */
export const POST = route(async ({ req, user }) => {
  const d = await body(req, schema);
  const nextFree = await findSlot(user.id, { from: d.date, to: addDays(d.date, 6), duration: d.durationMin });
  if (!d.startTime) return { conflicts: [], nextFree };
  const c = await checkConflicts(user.id, { date: d.date, startTime: d.startTime, endTime: addMinutesToTime(d.startTime, d.durationMin), durationMin: d.durationMin }, d.excludeId);
  return { ...c, nextFree };
});
