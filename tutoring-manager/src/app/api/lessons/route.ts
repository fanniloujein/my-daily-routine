import { prisma } from "@/lib/db";
import { route, body, qs } from "@/lib/api";
import { lessonSchema } from "@/lib/validation";

export const GET = route(async ({ req }) => {
  const q = qs(req).get("q")?.trim();
  return prisma.lesson.findMany({
    where: q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { chapter: { title: { contains: q, mode: "insensitive" } } }] } : {},
    include: { chapter: { include: { subject: { select: { name: true, color: true } }, level: { select: { name: true } } } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
});

export const POST = route(async ({ req }) => {
  const { exercises, ...v } = await body(req, lessonSchema);
  return prisma.lesson.create({ data: { ...v, exercises: { create: exercises.map(({ id: _id, ...e }, order) => (void _id, { ...e, order })) } } });
});
