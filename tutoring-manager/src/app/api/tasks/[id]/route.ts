import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { taskSchema } from "@/lib/validation";

type P = { id: string };
const save = (status?: string) => (status ? { completedAt: status === "DONE" ? new Date() : null } : {});

export const PUT = route<P>(async ({ req, params }) => {
  const v = await body(req, taskSchema);
  return prisma.task.update({ where: { id: params.id }, data: { ...v, ...save(v.status) } });
});
export const PATCH = route<P>(async ({ req, params }) => {
  const v = await body(req, taskSchema.partial());
  return prisma.task.update({ where: { id: params.id }, data: { ...v, ...save(v.status) } });
});
export const DELETE = route<P>(async ({ params }) => {
  await prisma.task.delete({ where: { id: params.id } });
});
