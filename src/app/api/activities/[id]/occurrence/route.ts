import { NextResponse } from "next/server";
import { z } from "zod";
import { body, route } from "@/lib/api";
import { dateStr, timeStr } from "@/lib/validation";
import { addDays, addMinutesToTime } from "@/lib/dates";
import { getActivityOwned, patchOccurrence } from "@/server/occurrences";
import { onActivityStatusChange } from "@/server/hooks";
import { postponeOccurrence } from "@/server/planning";
import { checkConflicts } from "@/server/conflicts";
import { prisma } from "@/lib/db";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), date: dateStr, status: z.enum(["TODO", "IN_PROGRESS", "DONE", "POSTPONED"]) }),
  z.object({ action: z.literal("postpone"), date: dateStr, toDate: dateStr.optional() }),
  z.object({
    action: z.literal("move"),
    date: dateStr,
    newDate: dateStr,
    startTime: timeStr.nullable().optional(),
    allowConflict: z.boolean().optional(),
  }),
]);

/** Actions rapides sur UNE occurrence : terminer, reporter, déplacer. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const input = await body(req, schema);
  const a = await getActivityOwned(user.id, params.id);

  if (input.action === "status") {
    let previous: string = a.status;
    if (a.recurrence !== "NONE") {
      const ex = await prisma.activityException.findUnique({ where: { activityId_date: { activityId: a.id, date: input.date } } });
      previous = ex?.status ?? "TODO";
    }
    await patchOccurrence(user.id, a.id, input.date, { status: input.status });
    await onActivityStatusChange(a, previous, input.status);
    return { ok: true };
  }
  if (input.action === "postpone") {
    await postponeOccurrence(user.id, a.id, input.date, input.toDate);
    return { ok: true, toDate: input.toDate ?? addDays(input.date, 1) };
  }
  // Déplacement à un autre jour (et éventuellement une autre heure)
  const startTime = input.startTime === undefined ? a.startTime : input.startTime;
  const endTime = startTime ? addMinutesToTime(startTime, a.durationMin) : null;
  if (!input.allowConflict && startTime) {
    const c = await checkConflicts(user.id, { date: input.newDate, startTime, endTime, durationMin: a.durationMin }, a.id);
    if (c.conflicts.length) return NextResponse.json({ error: "Conflit d'horaire", ...c }, { status: 409 });
  }
  await patchOccurrence(user.id, a.id, input.date, { newDate: input.newDate, startTime, endTime });
  return { ok: true };
});
