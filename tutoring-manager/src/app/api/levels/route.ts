import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { levelSchema } from "@/lib/validation";

export const GET = route(async () =>
  prisma.level.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], include: { _count: { select: { students: true } } } }),
);

export const POST = route(async ({ req }) => {
  const v = await body(req, levelSchema);
  const max = await prisma.level.aggregate({ _max: { order: true } });
  return prisma.level.create({ data: { ...v, order: v.order || (max._max.order ?? 0) + 1 } });
});
