import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { packageSchema } from "@/lib/validation";

export const POST = route(async ({ req }) => {
  const v = await body(req, packageSchema);
  return prisma.package.create({ data: { ...v, amount: new Prisma.Decimal(v.amount) } });
});
