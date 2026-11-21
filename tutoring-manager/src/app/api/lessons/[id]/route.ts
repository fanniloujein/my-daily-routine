import { prisma } from "@/lib/db";
import { route, body, fail } from "@/lib/api";
import { lessonSchema } from "@/lib/validation";

type P = { id: string };

export const GET = route<P>(async ({ params }) => {
  const l = await prisma.lesson.findUnique({
    where: { id: params.id },
    include: {
      chapter: { include: { subject: true, level: true } },
      exercises: { orderBy: { order: "asc" } },
      documents: { select: { id: true, name: true, type: true, mimeType: true, size: true, url: true } },
      sessions: { include: { session: { include: { participants: { include: { student: { select: { firstName: true, lastName: true } } } } } } } },
    },
  });
  return l ?? fail(404, "Préparation introuvable.");
});

export const PUT = route<P>(async ({ req, params }) => {
  const { exercises, ...v } = await body(req, lessonSchema);
  return prisma.$transaction(async (tx) => {
    await tx.exercise.deleteMany({ where: { lessonId: params.id } });
    return tx.lesson.update({ where: { id: params.id }, data: { ...v, exercises: { create: exercises.map(({ id: _id, ...e }, order) => (void _id, { ...e, order })) } } });
  });
});

export const DELETE = route<P>(async ({ params }) => {
  await prisma.lesson.delete({ where: { id: params.id } });
});
