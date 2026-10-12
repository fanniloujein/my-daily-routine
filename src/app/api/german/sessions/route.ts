import { prisma } from "@/lib/db";
import { body, route, searchParam } from "@/lib/api";
import { germanSessionSchema } from "@/lib/validation";
import { addDays, addMinutesToTime, today } from "@/lib/dates";
import { categoryForKind } from "@/server/categories";
import { findSlot } from "@/server/scheduling";

export const GET = route(async ({ req, user }) => {
  const from = searchParam(req, "from") ?? addDays(today(), -28);
  const to = searchParam(req, "to") ?? addDays(today(), 28);
  return prisma.germanSession.findMany({ where: { userId: user.id, date: { gte: from, lte: to } }, orderBy: [{ date: "desc" }, { startTime: "asc" }] });
});

/** Crée une session et son créneau dans l'agenda (heure choisie ou premier créneau libre). */
export const POST = route(async ({ req, user }) => {
  const raw = (await req.clone().json().catch(() => ({}))) as { autoSlot?: boolean };
  const d = await body(req, germanSessionSchema);
  let start = d.startTime;
  if (!start && raw.autoSlot) start = (await findSlot(user.id, { from: d.date, to: d.date, duration: d.durationMin }))?.startTime ?? null;
  const session = await prisma.germanSession.create({ data: { ...d, startTime: start, userId: user.id } });
  const cat = await categoryForKind(user.id, "german");
  await prisma.activity.create({
    data: {
      userId: user.id,
      categoryId: cat.id,
      title: `Allemand — ${d.objective}`,
      date: d.date,
      startTime: start,
      endTime: start ? addMinutesToTime(start, d.durationMin) : null,
      durationMin: d.durationMin,
      status: d.done ? "DONE" : "TODO",
      germanSessionId: session.id,
      reminders: start ? [cat.reminderMinutes ?? 10] : [],
    },
  });
  return session;
});
