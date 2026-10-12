import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { dateStr } from "@/lib/validation";
import { categoryForKind } from "@/server/categories";
import { findSlot } from "@/server/scheduling";

/** Planifie une révision future liée à une séance (créneau libre réel). */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const l = await prisma.lesson.findFirstOrThrow({ where: { id: params.id, userId: user.id }, include: { student: true } });
  const d = await body(req, z.object({ date: dateStr, durationMin: z.number().int().min(10).max(240).default(30), note: z.string().max(300).optional() }));
  const cat = await categoryForKind(user.id, "prep");
  const slot = await findSlot(user.id, { from: d.date, to: d.date, duration: d.durationMin });
  const act = await prisma.activity.create({
    data: {
      userId: user.id,
      categoryId: cat.id,
      title: `Révision prévue — ${l.student.name} (${l.subject}${l.chapter ? ` : ${l.chapter}` : ""})`,
      date: d.date,
      startTime: slot?.startTime ?? null,
      endTime: slot?.endTime ?? null,
      durationMin: d.durationMin,
      description: d.note ?? l.nextSteps,
      lessonId: l.id,
      lessonRole: "revision",
    },
  });
  return { activity: act, placed: !!slot };
});
