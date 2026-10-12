import { prisma } from "@/lib/db";
import { body, route, searchParam } from "@/lib/api";
import { lessonSchema } from "@/lib/validation";
import { addDays, today } from "@/lib/dates";
import { createLesson, lessonReadiness } from "@/server/lessons";
import { checkConflicts } from "@/server/conflicts";
import { timeToMin } from "@/lib/dates";

export const GET = route(async ({ req, user }) => {
  const studentId = searchParam(req, "studentId");
  const scope = searchParam(req, "scope"); // upcoming | past | all
  const t = today();
  const lessons = await prisma.lesson.findMany({
    where: {
      userId: user.id,
      ...(studentId ? { studentId } : {}),
      ...(scope === "upcoming" ? { date: { gte: t }, status: "PLANNED" } : scope === "past" ? { OR: [{ date: { lt: t } }, { status: { not: "PLANNED" } }] } : {}),
    },
    orderBy: scope === "past" ? [{ date: "desc" }, { startTime: "desc" }] : [{ date: "asc" }, { startTime: "asc" }],
    include: { student: true, prepItems: { orderBy: { order: "asc" } }, activities: true, resources: true },
    take: 100,
  });
  return lessons.map((l) => ({ ...l, readiness: lessonReadiness(l, l.prepItems, l.activities.find((a) => a.lessonRole === "prep")) }));
});

/** Crée une séance (ou une série hebdomadaire) avec sa préparation réservée dans l'agenda. */
export const POST = route(async ({ req, user }) => {
  const raw = (await req.clone().json().catch(() => ({}))) as { allowConflict?: boolean };
  const d = await body(req, lessonSchema);
  if (!raw.allowConflict) {
    for (let w = 0; w <= d.recurrenceWeeks; w++) {
      const date = addDays(d.date, 7 * w);
      const c = await checkConflicts(user.id, { date, startTime: d.startTime, endTime: d.endTime, durationMin: timeToMin(d.endTime) - timeToMin(d.startTime) });
      if (c.conflicts.length) return Response.json({ error: "Conflit d'horaire", ...c }, { status: 409 });
    }
  }
  const results = [];
  for (let w = 0; w <= d.recurrenceWeeks; w++) {
    const date = addDays(d.date, 7 * w);
    results.push(await createLesson(user.id, { ...d, date, prepDate: w === 0 ? d.prepDate : null }));
  }
  return { lessons: results.map((r) => r.lesson), prepPlaced: results[0].prepPlaced };
});
