import { prisma } from "@/lib/db";
import { route, searchParam } from "@/lib/api";
import { addDays, isValidDateStr, nowTime, startOfWeek, timeToMin, today, minToTime } from "@/lib/dates";
import { freeSlots } from "@/lib/conflicts";
import { scoreTask } from "@/lib/planner";
import { readSettings } from "@/lib/validation";
import { getOccurrences } from "@/server/occurrences";
import { dosesFor } from "@/server/meds";
import { lessonReadiness } from "@/server/lessons";
import { hasDemo } from "@/server/demo";

export const GET = route(async ({ req, user }) => {
  const q = searchParam(req, "date");
  const date = q && isValidDateStr(q) ? q : today();
  const settings = readSettings(user.settings);
  const now = date === today() ? nowTime() : settings.dayStart;

  const [occ, upcoming, energy, doses, lessons, tasks, ws] = await Promise.all([
    getOccurrences(user.id, date, date),
    getOccurrences(user.id, date, addDays(date, 7)),
    prisma.energyCheckin.findUnique({ where: { userId_date: { userId: user.id, date } } }),
    dosesFor(user.id, date),
    prisma.lesson.findMany({
      where: { userId: user.id, status: "PLANNED", date: { gte: date } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 4,
      include: { student: true, prepItems: true, activities: true },
    }),
    prisma.projectTask.findMany({
      where: { project: { userId: user.id, status: "ACTIVE" }, status: { not: "DONE" } },
      include: { project: true },
    }),
    Promise.resolve(startOfWeek(date)),
  ]);

  const energyLevel = energy?.energy ?? 3;
  const open = occ.filter((o) => o.status !== "DONE" && o.status !== "POSTPONED");
  const priorities = open
    .filter((o) => !o.category.kind || !["meds", "rest", "leisure"].includes(o.category.kind))
    .map((o) => ({ o, s: scoreTask({ id: o.id, occurrenceDate: o.originalDate, title: o.title, durationMin: o.durationMin, priority: o.priority, energyCost: o.energyCost, dueDate: o.dueDate, categoryKind: o.category.kind, postponeCount: o.postponeCount }, date, energyLevel) + (o.isFixed ? 5 : 0) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.o);

  const next = upcoming
    .filter((o) => o.status !== "DONE" && o.status !== "POSTPONED" && o.startTime && (o.date > date || o.endTime! > now))
    .slice(0, 6);

  const prepTasks = upcoming.filter((o) => (o.lessonRole === "prep" || o.category.kind === "prep") && o.status !== "DONE").slice(0, 4);

  const urgentTasks = tasks
    .map((t) => ({ ...t, urgency: (t.dueDate && t.dueDate <= addDays(date, 2) ? 2 : 0) + (t.priority >= 4 ? 2 : t.priority === 3 ? 1 : 0) + (t.project.deadline && t.project.deadline <= addDays(date, 7) ? 1 : 0) }))
    .filter((t) => t.urgency >= 2)
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 4)
    .map((t) => ({ id: t.id, title: t.title, project: t.project.name, projectId: t.projectId, client: t.project.client, dueDate: t.dueDate ?? t.project.deadline, priority: t.priority, status: t.status }));

  const germanToday = occ.filter((o) => o.category.kind === "german").reduce((s, o) => s + o.durationMin, 0);
  const germanWeek = await prisma.germanSession.aggregate({ where: { userId: user.id, date: { gte: ws, lte: addDays(ws, 6) }, done: true }, _sum: { durationMin: true } });
  const nextSport = upcoming.find((o) => o.category.kind === "sport" && o.status !== "DONE" && (o.date > date || !o.endTime || o.endTime > now)) ?? null;
  const dueCards = await prisma.flashcard.count({ where: { userId: user.id, dueDate: { lte: date } } });

  // Temps libre : créneaux sans activité entre maintenant et la fin de journée
  const busy = open.filter((o) => o.startTime && o.endTime);
  const free = freeSlots(busy, settings.dayStart, settings.dayEnd, 0, now > settings.dayStart ? now : undefined);
  const freeMinutes = free.reduce((s, x) => s + (x.end - x.start), 0);
  const untimedMinutes = open.filter((o) => !o.startTime).reduce((s, o) => s + o.durationMin, 0);

  const total = occ.length + doses.length;
  const doneCount = occ.filter((o) => o.status === "DONE").length + doses.filter((d) => d.status === "TAKEN").length;

  return {
    date,
    now,
    name: user.name,
    settings: { privacyMode: settings.privacyMode, dayEnd: settings.dayEnd },
    energy,
    schedule: occ,
    priorities,
    next,
    doses,
    lessons: lessons.map((l) => {
      const prep = l.activities.find((a) => a.lessonRole === "prep") ?? null;
      return {
        id: l.id,
        date: l.date,
        startTime: l.startTime,
        endTime: l.endTime,
        subject: l.subject,
        chapter: l.chapter,
        student: { id: l.student.id, name: l.student.name, color: l.student.color },
        readiness: lessonReadiness(l, l.prepItems, prep),
      };
    }),
    prepTasks,
    urgentTasks,
    german: { todayMinutes: germanToday, weekMinutes: germanWeek._sum.durationMin ?? 0, weekGoal: settings.germanWeeklyMinutes, dueCards },
    nextSport,
    freeTime: {
      minutes: Math.max(0, freeMinutes - untimedMinutes),
      slots: free.filter((s) => s.end - s.start >= 30).slice(0, 4).map((s) => ({ start: minToTime(s.start), end: minToTime(s.end) })),
      untimedMinutes,
    },
    progress: { done: doneCount, total, percent: total ? Math.round((doneCount / total) * 100) : 0 },
    hasDemo: await hasDemo(user.id),
    nowMinutes: timeToMin(now),
  };
});
