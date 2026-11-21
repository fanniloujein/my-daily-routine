import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, body, qs } from "@/lib/api";
import { homeworkSchema } from "@/lib/validation";

export const GET = route(async ({ req }) => {
  const p = qs(req);
  const where: Prisma.HomeworkWhereInput = {
    ...(p.get("status") ? { status: p.get("status")! } : {}),
    ...(p.get("studentId") ? { studentId: p.get("studentId")! } : {}),
    ...(p.get("subjectId") ? { subjectId: p.get("subjectId")! } : {}),
    ...(p.get("type") ? { type: p.get("type")! } : {}),
  };
  return prisma.homework.findMany({
    where,
    include: { student: { select: { id: true, firstName: true, lastName: true } }, subject: { select: { id: true, name: true, color: true } }, lesson: { select: { id: true, title: true } } },
    orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
});

export const POST = route(async ({ req }) => prisma.homework.create({ data: await body(req, homeworkSchema) }));
