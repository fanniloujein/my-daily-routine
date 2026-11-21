import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { assessmentSchema } from "@/lib/validation";

export const POST = route(async ({ req }) => {
  const v = await body(req, assessmentSchema);
  return prisma.assessment.create({ data: { ...v, score: new Prisma.Decimal(v.score), maxScore: new Prisma.Decimal(v.maxScore) } });
});
