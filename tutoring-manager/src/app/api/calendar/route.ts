import { prisma } from "@/lib/db";
import { route, qs, fail } from "@/lib/api";
import { expandWeekly } from "@/lib/schedule";
import { addDays, rangeDates, weekday } from "@/lib/dates";
import { sessionInclude } from "@/server/schedule";

// Événements du calendrier : séances, événements personnels, repos, tâches planifiées, disponibilités.
export const GET = route(async ({ req }) => {
  const p = qs(req);
  const from = p.get("from"), to = p.get("to");
  if (!from || !to) fail(400, "Période manquante.");
  if (rangeDates(from!, to!).length > 62) fail(400, "Période trop longue.");
  const [sessions, events, tasks, availability] = await Promise.all([
    prisma.session.findMany({ where: { date: { gte: from!, lte: to! } }, include: sessionInclude, orderBy: [{ date: "asc" }, { startTime: "asc" }] }),
    prisma.personalEvent.findMany({ where: { date: { lte: to! }, OR: [{ weeklyUntil: null, date: { gte: from! } }, { weeklyUntil: { gte: from! } }] } }),
    prisma.task.findMany({ where: { dueDate: { gte: from!, lte: to! }, time: { not: null }, status: { not: "DONE" } } }),
    prisma.availability.findMany(),
  ]);
  const avail = [];
  for (const d of rangeDates(from!, to!)) for (const a of availability.filter((x) => x.weekday === weekday(d))) avail.push({ date: d, startTime: a.startTime, endTime: a.endTime });
  return { sessions, events: expandWeekly(events, from!, to!), tasks, availability: avail, range: { from, to: addDays(to!, 0) } };
});
