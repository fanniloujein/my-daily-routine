import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { dateStr, timeStr } from "@/lib/validation";
import { addMinutesToTime } from "@/lib/dates";
import { categoryForKind } from "@/server/categories";
import { checkConflicts } from "@/server/conflicts";

/** Planifier une soirée cinéma / un épisode. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const m = await prisma.mediaItem.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  const d = await body(req, z.object({ date: dateStr, startTime: timeStr, allowConflict: z.boolean().optional() }));
  const endTime = addMinutesToTime(d.startTime, m.durationMin);
  if (!d.allowConflict) {
    const c = await checkConflicts(user.id, { date: d.date, startTime: d.startTime, endTime, durationMin: m.durationMin });
    if (c.conflicts.length) return NextResponse.json({ error: "Conflit d'horaire", ...c }, { status: 409 });
  }
  const cat = await categoryForKind(user.id, "leisure");
  return prisma.activity.create({
    data: {
      userId: user.id,
      categoryId: cat.id,
      title: m.type === "MOVIE" ? `Soirée cinéma — ${m.title}` : `Épisode — ${m.title}`,
      date: d.date,
      startTime: d.startTime,
      endTime,
      durationMin: m.durationMin,
      energyCost: 1,
      mediaItemId: m.id,
      reminders: [15],
    },
  });
});
