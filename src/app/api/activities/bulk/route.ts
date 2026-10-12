import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { dateStr } from "@/lib/validation";
import { patchOccurrence } from "@/server/occurrences";
import { postponeOccurrence } from "@/server/planning";
import { onActivityStatusChange } from "@/server/hooks";

const schema = z.object({
  action: z.enum(["delete", "postpone", "move", "done"]),
  items: z.array(z.object({ id: z.string(), date: dateStr })).min(1).max(500),
  toDate: dateStr.optional(),
});

/** Actions groupées sur plusieurs occurrences (supprimer, reporter, déplacer, terminer). */
export const POST = route(async ({ req, user }) => {
  const d = await body(req, schema);
  let count = 0;
  for (const it of d.items) {
    const a = await prisma.activity.findFirst({ where: { id: it.id, userId: user.id } });
    if (!a) continue;
    if (d.action === "delete") {
      if (a.recurrence !== "NONE") await patchOccurrence(user.id, a.id, it.date, { cancelled: true });
      else await prisma.activity.delete({ where: { id: a.id } });
    } else if (d.action === "postpone") {
      await postponeOccurrence(user.id, a.id, it.date, d.toDate);
    } else if (d.action === "move") {
      if (!d.toDate) continue;
      await patchOccurrence(user.id, a.id, it.date, { newDate: d.toDate, ...(a.isFixed ? {} : { startTime: null, endTime: null }) });
    } else {
      await patchOccurrence(user.id, a.id, it.date, { status: "DONE" });
      if (a.recurrence === "NONE") await onActivityStatusChange(a, a.status, "DONE");
    }
    count++;
  }
  return { ok: true, count };
});
