import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { projectEventSchema } from "@/lib/validation";
import { addMinutesToTime } from "@/lib/dates";
import { categoryForKind } from "@/server/categories";

/** Réunion ou livrable ; une réunion avec horaire est aussi ajoutée au planning (rendez-vous fixe). */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const p = await prisma.project.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  const d = await body(req, projectEventSchema);
  const ev = await prisma.projectEvent.create({ data: { ...d, projectId: p.id } });
  if (d.type === "MEETING" && d.time) {
    const cat = await categoryForKind(user.id, "freelance");
    await prisma.activity.create({
      data: { userId: user.id, categoryId: cat.id, title: `${d.title} — ${p.client}`, date: d.date, startTime: d.time, endTime: addMinutesToTime(d.time, 60), durationMin: 60, isFixed: true, priority: 3, reminders: [30] },
    });
  }
  return ev;
});
