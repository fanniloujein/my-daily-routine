import { prisma } from "@/lib/db";
import { body, route, searchParam } from "@/lib/api";
import { energySchema } from "@/lib/validation";
import { addDays, today } from "@/lib/dates";

export const GET = route(async ({ req, user }) => {
  const date = searchParam(req, "date");
  if (date) return prisma.energyCheckin.findUnique({ where: { userId_date: { userId: user.id, date } } });
  return prisma.energyCheckin.findMany({ where: { userId: user.id, date: { gte: addDays(today(), -30) } }, orderBy: { date: "asc" } });
});

export const POST = route(async ({ req, user }) => {
  const d = await body(req, energySchema);
  return prisma.energyCheckin.upsert({
    where: { userId_date: { userId: user.id, date: d.date } },
    create: { ...d, userId: user.id },
    update: d,
  });
});
