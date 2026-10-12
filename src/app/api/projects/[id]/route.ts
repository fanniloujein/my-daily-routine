import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { projectSchema } from "@/lib/validation";

export const GET = route<{ id: string }>(async ({ user, params }) =>
  prisma.project.findFirstOrThrow({
    where: { id: params.id, userId: user.id },
    include: {
      tasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], include: { activities: { select: { id: true, date: true, startTime: true, endTime: true, status: true, durationMin: true } } } },
      events: { orderBy: [{ date: "asc" }, { time: "asc" }] },
    },
  }),
);

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  await prisma.project.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  const { template: _t, ...d } = await body(req, projectSchema.partial());
  void _t;
  return prisma.project.update({ where: { id: params.id }, data: d });
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.project.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  await prisma.project.delete({ where: { id: params.id } });
  return { ok: true };
});
