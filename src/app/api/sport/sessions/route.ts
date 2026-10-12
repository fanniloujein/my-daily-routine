import { prisma } from "@/lib/db";
import { body, route, searchParam } from "@/lib/api";
import { sportSessionSchema } from "@/lib/validation";
import { addDays, addMinutesToTime, today } from "@/lib/dates";
import { categoryForKind } from "@/server/categories";
import { findSlot } from "@/server/scheduling";

export const GET = route(async ({ req, user }) => {
  const from = searchParam(req, "from") ?? addDays(today(), -56);
  const to = searchParam(req, "to") ?? addDays(today(), 28);
  return prisma.sportSession.findMany({ where: { userId: user.id, date: { gte: from, lte: to } }, orderBy: [{ date: "desc" }] });
});

export const POST = route(async ({ req, user }) => {
  const raw = (await req.clone().json().catch(() => ({}))) as { autoSlot?: boolean };
  const d = await body(req, sportSessionSchema);
  let start = d.startTime;
  if (!start && raw.autoSlot) start = (await findSlot(user.id, { from: d.date, to: d.date, duration: d.durationMin }))?.startTime ?? null;
  const s = await prisma.sportSession.create({ data: { ...d, startTime: start, userId: user.id } });
  const cat = await categoryForKind(user.id, "sport");
  await prisma.activity.create({
    data: {
      userId: user.id,
      categoryId: cat.id,
      title: `Sport — ${d.type}`,
      date: d.date,
      startTime: start,
      endTime: start ? addMinutesToTime(start, d.durationMin) : null,
      durationMin: d.durationMin,
      energyCost: d.intensity,
      status: d.status === "DONE" ? "DONE" : "TODO",
      sportSessionId: s.id,
      reminders: start ? [cat.reminderMinutes ?? 30] : [],
    },
  });
  return s;
});
