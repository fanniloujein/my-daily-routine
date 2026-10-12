import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { sportSessionSchema, dateStr } from "@/lib/validation";
import { addMinutesToTime } from "@/lib/dates";

const patch = sportSessionSchema.partial().extend({ postponeTo: dateStr.optional() });

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const existing = await prisma.sportSession.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  const { postponeTo, ...d } = await body(req, patch);
  if (postponeTo) {
    // Report : nouvelle date, horaire libéré (à replacer dans un créneau libre)
    d.date = postponeTo;
    d.status = "PLANNED";
  }
  const s = await prisma.sportSession.update({ where: { id: existing.id }, data: d });
  await prisma.activity.updateMany({
    where: { sportSessionId: s.id, userId: user.id },
    data: {
      title: `Sport — ${s.type}`,
      date: s.date,
      startTime: postponeTo ? null : s.startTime,
      endTime: postponeTo || !s.startTime ? null : addMinutesToTime(s.startTime, s.durationMin),
      durationMin: s.durationMin,
      status: s.status === "DONE" ? "DONE" : "TODO",
      completedAt: s.status === "DONE" ? new Date() : null,
      ...(postponeTo ? { postponeCount: { increment: 1 } } : {}),
    },
  });
  if (postponeTo) await prisma.sportSession.update({ where: { id: s.id }, data: { startTime: null } });
  return s;
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.sportSession.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  await prisma.activity.deleteMany({ where: { sportSessionId: params.id, userId: user.id } });
  await prisma.sportSession.delete({ where: { id: params.id } });
  return { ok: true };
});

