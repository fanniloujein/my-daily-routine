import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { studentSchema } from "@/lib/validation";

export const GET = route<{ id: string }>(async ({ user, params }) =>
  prisma.student.findFirstOrThrow({
    where: { id: params.id, userId: user.id },
    include: { lessons: { orderBy: [{ date: "desc" }, { startTime: "desc" }], include: { prepItems: { orderBy: { order: "asc" } } } }, resources: { orderBy: { createdAt: "desc" } } },
  }),
);

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  await prisma.student.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  const d = await body(req, studentSchema.partial());
  return prisma.student.update({ where: { id: params.id }, data: d });
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.student.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  await prisma.student.delete({ where: { id: params.id } });
  return { ok: true };
});
