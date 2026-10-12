import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { projectTaskSchema } from "@/lib/validation";

async function owned(userId: string, id: string) {
  return prisma.projectTask.findFirstOrThrow({ where: { id, project: { userId } } });
}

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const t = await owned(user.id, params.id);
  const d = await body(req, projectTaskSchema.partial());
  return prisma.projectTask.update({
    where: { id: t.id },
    data: { ...d, ...(d.status ? { doneAt: d.status === "DONE" ? (t.doneAt ?? new Date()) : null } : {}) },
  });
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await owned(user.id, params.id);
  await prisma.projectTask.delete({ where: { id: params.id } });
  return { ok: true };
});
