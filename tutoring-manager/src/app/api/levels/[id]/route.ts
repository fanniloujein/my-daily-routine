import { prisma } from "@/lib/db";
import { route, body, fail } from "@/lib/api";
import { levelSchema } from "@/lib/validation";

type P = { id: string };

export const PUT = route<P>(async ({ req, params }) => prisma.level.update({ where: { id: params.id }, data: await body(req, levelSchema) }));

export const DELETE = route<P>(async ({ params }) => {
  const n = await prisma.student.count({ where: { levelId: params.id } });
  if (n > 0) fail(409, `Ce niveau est utilisé par ${n} élève(s) : modifiez-les d'abord.`);
  await prisma.level.delete({ where: { id: params.id } });
});
