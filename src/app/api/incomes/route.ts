import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { incomeSchema } from "@/lib/validation";
import { createIncome } from "@/server/finance";

export const GET = route(async ({ user }) =>
  prisma.income.findMany({ where: { userId: user.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 500, include: { student: { select: { id: true, name: true, color: true, isGroup: true } } } }),
);

/** Nouveau revenu (paiement d'un élève/groupe, mission freelance, autre). */
export const POST = route(async ({ req, user }) => createIncome(user.id, await body(req, incomeSchema)));
