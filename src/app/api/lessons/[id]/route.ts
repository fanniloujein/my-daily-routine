import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { lessonSchema } from "@/lib/validation";
import { timeToMin } from "@/lib/dates";
import { lessonReadiness } from "@/server/lessons";
import { checkConflicts } from "@/server/conflicts";
import { z } from "zod";

async function owned(userId: string, id: string) {
  return prisma.lesson.findFirstOrThrow({ where: { id, userId }, include: { activities: true } });
}

export const GET = route<{ id: string }>(async ({ user, params }) => {
  const l = await prisma.lesson.findFirstOrThrow({
    where: { id: params.id, userId: user.id },
    include: { student: true, prepItems: { orderBy: { order: "asc" } }, resources: true, activities: true },
  });
  return { ...l, readiness: lessonReadiness(l, l.prepItems, l.activities.find((a) => a.lessonRole === "prep")) };
});

const patchSchema = z.object({
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  subject: z.string().optional(),
  chapter: z.string().nullish(),
  prepMinutes: z.number().optional(),
  status: z.enum(["PLANNED", "DONE", "CANCELLED"]).optional(),
  remarks: z.string().nullish(),
  nextSteps: z.string().nullish(),
  allowConflict: z.boolean().optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const l = await owned(user.id, params.id);
  const raw = await body(req, patchSchema);
  const merged = lessonSchema.parse({ ...l, ...raw, prepDate: null, recurrenceWeeks: 0 });
  const moved = merged.date !== l.date || merged.startTime !== l.startTime || merged.endTime !== l.endTime;
  if (moved && !raw.allowConflict && merged.status === "PLANNED") {
    const session = l.activities.find((a) => a.lessonRole === "session");
    const c = await checkConflicts(user.id, { date: merged.date, startTime: merged.startTime, endTime: merged.endTime, durationMin: timeToMin(merged.endTime) - timeToMin(merged.startTime) }, session?.id);
    if (c.conflicts.length) return Response.json({ error: "Conflit d'horaire", ...c }, { status: 409 });
  }
  const updated = await prisma.lesson.update({
    where: { id: l.id },
    data: {
      date: merged.date,
      startTime: merged.startTime,
      endTime: merged.endTime,
      subject: merged.subject,
      chapter: merged.chapter,
      prepMinutes: merged.prepMinutes,
      status: merged.status,
      remarks: merged.remarks,
      nextSteps: merged.nextSteps,
    },
  });
  // Synchroniser le créneau de la séance dans l'agenda
  const session = l.activities.find((a) => a.lessonRole === "session");
  if (session) {
    await prisma.activity.update({
      where: { id: session.id },
      data: {
        date: updated.date,
        startTime: updated.startTime,
        endTime: updated.endTime,
        durationMin: timeToMin(updated.endTime) - timeToMin(updated.startTime),
        status: updated.status === "DONE" ? "DONE" : "TODO",
        completedAt: updated.status === "DONE" ? new Date() : null,
        description: updated.chapter ? `Chapitre : ${updated.chapter}` : null,
      },
    });
    await prisma.activity.updateMany({ where: { lessonId: l.id, lessonRole: "prep" }, data: { dueDate: updated.date } });
    if (updated.status === "CANCELLED") await prisma.activity.deleteMany({ where: { lessonId: l.id, status: { not: "DONE" } } });
  }
  return updated;
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await owned(user.id, params.id);
  await prisma.lesson.delete({ where: { id: params.id } }); // les créneaux liés sont supprimés en cascade
  return { ok: true };
});
