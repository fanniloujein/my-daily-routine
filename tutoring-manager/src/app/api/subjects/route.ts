import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { subjectSchema } from "@/lib/validation";

export const GET = route(async () =>
  (
    await prisma.subject.findMany({
      orderBy: [{ archived: "asc" }, { name: "asc" }],
      include: { levels: { include: { level: true } }, _count: { select: { students: true, sessions: true, chapters: true } } },
    })
  ).map((s) => ({ ...s, levels: s.levels.map((l) => l.level) })),
);

export const POST = route(async ({ req }) => {
  const { levelIds, defaultRate, ...v } = await body(req, subjectSchema);
  return prisma.subject.create({
    data: { ...v, defaultRate: defaultRate == null ? null : new Prisma.Decimal(defaultRate), levels: { create: levelIds.map((levelId) => ({ levelId })) } },
  });
});
