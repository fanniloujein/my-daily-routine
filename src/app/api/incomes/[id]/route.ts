import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { incomeSchema } from "@/lib/validation";

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  await prisma.income.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  const { lessonIds: _l, ...d } = await body(req, incomeSchema.partial());
  void _l;
  return prisma.income.update({ where: { id: params.id }, data: d });
});

/** Supprimer un paiement : les séances qu'il réglait redeviennent « à payer ». */
export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.income.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  await prisma.income.delete({ where: { id: params.id } });
  return { ok: true };
});
