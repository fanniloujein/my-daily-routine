import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { packageSchema } from "@/lib/validation";

// Modifier un forfait n'affecte pas les mois déjà facturés (le montant facturé est figé sur la facture).
export const PUT = route<{ id: string }>(async ({ req, params }) => {
  const v = await body(req, packageSchema);
  return prisma.package.update({ where: { id: params.id }, data: { ...v, amount: new Prisma.Decimal(v.amount) } });
});
