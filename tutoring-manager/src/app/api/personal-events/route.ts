import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, body, qs, serialize } from "@/lib/api";
import { personalEventSchema } from "@/lib/validation";
import { conflictsFor } from "@/server/schedule";

export const GET = route(async ({ req }) => {
  const p = qs(req);
  const from = p.get("from"), to = p.get("to");
  return prisma.personalEvent.findMany({
    where: from && to ? { date: { lte: to }, OR: [{ weeklyUntil: null, date: { gte: from } }, { weeklyUntil: { gte: from } }] } : {},
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
});

export const POST = route(async ({ req }) => {
  const v = await body(req, personalEventSchema.and(z.object({ force: z.boolean().default(false) })));
  const { force, ...data } = v;
  if (!force) {
    const found = await conflictsFor([{ date: data.date, startTime: data.startTime, endTime: data.endTime }]);
    if (found.length) return NextResponse.json(serialize({ error: `Ce créneau est déjà occupé : ${found[0].conflicts.map((c) => c.label).join(", ")}`, conflicts: found }), { status: 409 });
  }
  return prisma.personalEvent.create({ data });
});
