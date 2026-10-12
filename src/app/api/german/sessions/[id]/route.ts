import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { germanSessionSchema } from "@/lib/validation";
import { addMinutesToTime } from "@/lib/dates";

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  await prisma.germanSession.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  const d = await body(req, germanSessionSchema.partial());
  const s = await prisma.germanSession.update({ where: { id: params.id }, data: d });
  await prisma.activity.updateMany({
    where: { germanSessionId: s.id, userId: user.id },
    data: {
      title: `Allemand — ${s.objective}`,
      date: s.date,
      startTime: s.startTime,
      endTime: s.startTime ? addMinutesToTime(s.startTime, s.durationMin) : null,
      durationMin: s.durationMin,
      status: s.done ? "DONE" : "TODO",
      completedAt: s.done ? new Date() : null,
    },
  });
  return s;
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.germanSession.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  await prisma.activity.deleteMany({ where: { germanSessionId: params.id, userId: user.id } });
  await prisma.germanSession.delete({ where: { id: params.id } });
  return { ok: true };
});
