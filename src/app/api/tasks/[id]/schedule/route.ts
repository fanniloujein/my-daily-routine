import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { dateStr } from "@/lib/validation";
import { addDays, today } from "@/lib/dates";
import { categoryForKind } from "@/server/categories";
import { findSlot } from "@/server/scheduling";

/** Réserve un créneau de développement pour une tâche, dans le premier créneau libre réel. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const t = await prisma.projectTask.findFirstOrThrow({ where: { id: params.id, project: { userId: user.id } }, include: { project: true } });
  const d = await body(req, z.object({ from: dateStr.optional(), durationMin: z.number().int().min(15).max(480).default(90) }));
  const from = d.from ?? today();
  const slot = await findSlot(user.id, { from, to: addDays(from, 13), duration: d.durationMin, workOnly: true });
  if (!slot) throw new HttpError(409, "Aucun créneau libre trouvé sur les 14 prochains jours. Libère du temps ou réduis la durée.");
  const cat = await categoryForKind(user.id, "freelance");
  const act = await prisma.activity.create({
    data: {
      userId: user.id,
      categoryId: cat.id,
      title: `${t.project.name} — ${t.title}`,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMin: d.durationMin,
      priority: t.priority,
      energyCost: 3,
      dueDate: t.dueDate ?? t.project.deadline,
      projectTaskId: t.id,
      reminders: cat.reminderMinutes != null ? [cat.reminderMinutes] : [10],
    },
  });
  return { activity: act, slot };
});
