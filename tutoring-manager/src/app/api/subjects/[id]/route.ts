import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, body, fail } from "@/lib/api";
import { subjectSchema } from "@/lib/validation";

type P = { id: string };

export const PUT = route<P>(async ({ req, params }) => {
  const { levelIds, defaultRate, ...v } = await body(req, subjectSchema);
  return prisma.$transaction(async (tx) => {
    await tx.subjectLevel.deleteMany({ where: { subjectId: params.id } });
    return tx.subject.update({
      where: { id: params.id },
      data: { ...v, defaultRate: defaultRate == null ? null : new Prisma.Decimal(defaultRate), levels: { create: levelIds.map((levelId) => ({ levelId })) } },
    });
  });
});

export const DELETE = route<P>(async ({ params }) => {
  const used = await prisma.subject.findUnique({ where: { id: params.id }, include: { _count: { select: { sessions: true, students: true, chapters: true } } } });
  if (!used) fail(404, "Matière introuvable.");
  if (used!._count.sessions + used!._count.students + used!._count.chapters > 0) {
    await prisma.subject.update({ where: { id: params.id }, data: { archived: true } });
    return { archived: true };
  }
  await prisma.subject.delete({ where: { id: params.id } });
  return { deleted: true };
});
