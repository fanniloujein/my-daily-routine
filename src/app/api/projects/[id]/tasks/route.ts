import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { projectTaskSchema } from "@/lib/validation";

export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  await prisma.project.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  const d = await body(req, projectTaskSchema);
  const max = await prisma.projectTask.aggregate({ where: { projectId: params.id }, _max: { order: true } });
  return prisma.projectTask.create({ data: { ...d, projectId: params.id, order: (max._max.order ?? 0) + 1, doneAt: d.status === "DONE" ? new Date() : null } });
});
