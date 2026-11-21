import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, body, qs } from "@/lib/api";
import { taskSchema } from "@/lib/validation";

export const GET = route(async ({ req }) => {
  const p = qs(req);
  const q = p.get("q")?.trim();
  const where: Prisma.TaskWhereInput = {
    ...(p.get("status") ? { status: { in: p.get("status")!.split(",") } } : {}),
    ...(p.get("category") ? { category: p.get("category")! } : {}),
    ...(p.get("from") || p.get("to") ? { dueDate: { gte: p.get("from") ?? undefined, lte: p.get("to") ?? undefined } } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
  };
  return prisma.task.findMany({ where, orderBy: [{ order: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }] });
});

export const POST = route(async ({ req }) => {
  const v = await body(req, taskSchema);
  return prisma.task.create({ data: { ...v, order: v.order ?? 0, completedAt: v.status === "DONE" ? new Date() : null } });
});
