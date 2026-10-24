import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { studentSchema } from "@/lib/validation";
import { assertGroupSize, checkMembers } from "@/server/students";
import { lessonPrice } from "@/lib/billing";
import { timeToMin } from "@/lib/dates";

export const GET = route<{ id: string }>(async ({ user, params }) =>
  prisma.student.findFirstOrThrow({
    where: { id: params.id, userId: user.id },
    include: { lessons: { orderBy: [{ date: "desc" }, { startTime: "desc" }], include: { prepItems: { orderBy: { order: "asc" } } } }, resources: { orderBy: { createdAt: "desc" } }, members: { select: { id: true, name: true, color: true } }, groups: { select: { id: true, name: true, color: true } } },
  }),
);

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const existing = await prisma.student.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  const { memberIds, ...d } = await body(req, studentSchema.partial());
  const isGroup = d.isGroup ?? existing.isGroup;
  const members = isGroup && memberIds ? await checkMembers(user.id, memberIds.filter((m) => m !== params.id)) : null;
  if (members) assertGroupSize(true, members.length);
  const updated = await prisma.student.update({
    where: { id: params.id },
    data: { ...d, ...(members ? { members: { set: members } } : {}), ...(!isGroup ? { members: { set: [] } } : {}) },
  });
  // Nouveau tarif : appliqué aux séances à venir non payées (les séances passées gardent leur prix)
  if (d.billingMode !== undefined || d.rate !== undefined) {
    const lessons = await prisma.lesson.findMany({ where: { studentId: updated.id, status: "PLANNED", incomeId: null } });
    for (const l of lessons) {
      await prisma.lesson.update({ where: { id: l.id }, data: { price: lessonPrice(updated.billingMode, updated.rate, timeToMin(l.endTime) - timeToMin(l.startTime)) } });
    }
  }
  return updated;
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.student.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  await prisma.student.delete({ where: { id: params.id } });
  return { ok: true };
});
