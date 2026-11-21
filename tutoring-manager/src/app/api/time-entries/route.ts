import { prisma } from "@/lib/db";
import { route, body, qs } from "@/lib/api";
import { timeEntrySchema } from "@/lib/validation";

export const GET = route(async ({ req }) => {
  const p = qs(req);
  return prisma.timeEntry.findMany({ where: { date: { gte: p.get("from") ?? undefined, lte: p.get("to") ?? undefined } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
});
export const POST = route(async ({ req }) => prisma.timeEntry.create({ data: await body(req, timeEntrySchema) }));
