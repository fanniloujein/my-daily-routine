import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { studentSchema } from "@/lib/validation";
import { assertGroupSize, checkMembers } from "@/server/students";

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
  return prisma.student.update({
    where: { id: params.id },
    data: { ...d, ...(members ? { members: { set: members } } : {}), ...(!isGroup ? { members: { set: [] } } : {}) },
  });
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.student.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  await prisma.student.delete({ where: { id: params.id } });
  return { ok: true };
});
