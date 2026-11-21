import { prisma } from "@/lib/db";
import { readSettings } from "@/lib/settings";
import { addDays, addMonths, daysBetween, duration, monthOf, nowParts, startOfWeek, toMinutes, fromMinutes } from "@/lib/dates";
import { busyMinutes, breakSuggestions, freeSlots, loadLevel, expandWeekly } from "@/lib/schedule";
import { fromMil } from "@/lib/money";
import { financeUniverse } from "./financeStats";
import { busyBlocks, FREEING_STATUSES, sessionInclude } from "./schedule";

const WORK_CATS = ["PREP", "CORRECTION", "ADMIN"];

export async function dashboard() {
  const user = await prisma.user.findFirst();
  const st = readSettings(user?.settings);
  const { date: t, time } = nowParts();
  const ws = startOfWeek(t), we = addDays(ws, 6);
  const month = monthOf(t);

  const [students, activeStudents, todaySessions, weekCount, monthDone, weekDone, tasksOpen, nextSessions, lastTx, entriesWeek, unprepared, draftLessons, homework, urgentTasks, events] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { archived: false } }),
    prisma.session.findMany({ where: { date: t, status: { notIn: ["CANCELLED"] } }, include: sessionInclude, orderBy: { startTime: "asc" } }),
    prisma.session.count({ where: { date: { gte: ws, lte: we }, status: { notIn: [...FREEING_STATUSES] } } }),
    prisma.session.count({ where: { date: { startsWith: month }, status: "DONE" } }),
    prisma.session.findMany({ where: { date: { gte: ws, lte: we }, status: "DONE" }, select: { startTime: true, endTime: true } }),
    prisma.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.session.findMany({
      where: { status: "PLANNED", OR: [{ date: { gt: t } }, { date: t, startTime: { gte: time } }] },
      include: sessionInclude,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 6,
    }),
    prisma.financialTransaction.findMany({ include: { student: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.timeEntry.findMany({ where: { date: { gte: ws, lte: we } } }),
    prisma.session.findMany({ where: { status: "PLANNED", prepared: false, date: { gte: t, lte: addDays(t, 7) } }, include: sessionInclude, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 8 }),
    prisma.lesson.findMany({ where: { status: "DRAFT" }, include: { chapter: { include: { subject: true } } }, orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.homework.findMany({ where: { status: "PENDING", dueDate: { lte: addDays(t, 7) } }, include: { student: { select: { firstName: true, lastName: true } }, subject: true }, orderBy: { dueDate: "asc" }, take: 8 }),
    prisma.task.findMany({ where: { status: { in: ["TODO", "IN_PROGRESS"] }, OR: [{ priority: { in: ["URGENT", "HIGH"] } }, { dueDate: { lte: addDays(t, 1) } }] }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }], take: 6 }),
    prisma.personalEvent.findMany({ where: { date: { lte: t }, OR: [{ weeklyUntil: null, date: t }, { weeklyUntil: { gte: t } }] } }),
  ]);
  const deadlinesTasks = await prisma.task.findMany({ where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { gte: t, lte: addDays(t, 7) } }, orderBy: { dueDate: "asc" }, take: 6 });

  // Finances
  const u = await financeUniverse();
  const cash = u.allocations.filter((a) => a.kind !== "DISCOUNT");
  let credit = 0, due = 0;
  const late: { id: string; name: string; due: number; since: string; days: number }[] = [];
  for (const s of u.students) {
    const l = u.perStudent.get(s.id)!;
    credit += l.totals.credit;
    due += l.totals.due;
    if (l.totals.due > 0 && !s.archived) {
      const open = u.invoices.filter((i) => i.studentId === s.id && !i.voidedAt && (l.invoices.get(i.id)?.remaining ?? 0) > 0).map((i) => i.date).sort();
      const since = open[0] ?? t;
      const days = daysBetween(since, t);
      if (days >= st.notifications.pendingPaymentDays) late.push({ id: s.id, name: `${s.firstName} ${s.lastName}`, due: fromMil(l.totals.due), since, days });
    }
  }
  late.sort((a, b) => b.days - a.days);
  const revenueMonths = Array.from({ length: 12 }, (_, i) => addMonths(month, i - 11)).map((m) => ({
    month: m,
    revenue: fromMil(cash.filter((a) => monthOf(a.date) === m).reduce((s, a) => s + a.amount, 0)),
  }));

  // Heures de cours (8 dernières semaines)
  const from8 = addDays(ws, -49);
  const done8 = await prisma.session.findMany({ where: { date: { gte: from8, lte: we }, status: "DONE" }, select: { date: true, startTime: true, endTime: true } });
  const hoursWeeks = Array.from({ length: 8 }, (_, i) => addDays(from8, i * 7)).map((w) => ({
    week: w,
    hours: Math.round((done8.filter((s) => s.date >= w && s.date <= addDays(w, 6)).reduce((a, s) => a + duration(s.startTime, s.endTime), 0) / 60) * 10) / 10,
  }));

  const teachWeek = weekDone.reduce((a, s) => a + duration(s.startTime, s.endTime), 0);
  const otherWeek = entriesWeek.filter((e) => WORK_CATS.includes(e.category)).reduce((a, e) => a + e.minutes, 0);

  // Temps libre restant aujourd'hui (entre maintenant et la fin de journée)
  const busy = await busyBlocks(t, t);
  const from = time > st.dayStart ? time : st.dayStart;
  const freeToday = from < st.dayEnd ? freeSlots(t, busy, from, st.dayEnd, 15) : [];
  const todayEvents = expandWeekly(events, t, t);

  return {
    today: t,
    now: time,
    teacherName: st.teacherName || user?.name || "",
    kpis: {
      students,
      activeStudents,
      sessionsToday: todaySessions.filter((s) => !FREEING_STATUSES.includes(s.status as (typeof FREEING_STATUSES)[number])).length,
      sessionsWeek: weekCount,
      hoursWorkedWeek: Math.round(((teachWeek + otherWeek) / 60) * 10) / 10,
      teachingHoursWeek: Math.round((teachWeek / 60) * 10) / 10,
      sessionsDoneMonth: monthDone,
      revenueMonth: fromMil(cash.filter((a) => monthOf(a.date) === month).reduce((s, a) => s + a.amount, 0)),
      revenueToday: fromMil(cash.filter((a) => a.date === t).reduce((s, a) => s + a.amount, 0)),
      pendingTotal: fromMil(due),
      creditTotal: fromMil(credit),
      tasksOpen,
      freeMinutesToday: freeToday.reduce((a, s) => a + s.minutes, 0),
      todayLoad: loadLevel(busyMinutes(t, busy.filter((b) => b.kind === "SESSION")), st.maxDailyHours),
    },
    todaySessions,
    todayEvents,
    freeToday,
    nextSessions,
    lastTransactions: lastTx,
    latePayers: late.slice(0, 6),
    unprepared,
    draftLessons,
    urgentTasks,
    deadlines: [
      ...homework.map((h) => ({ id: h.id, kind: "homework" as const, title: h.title, date: h.dueDate!, detail: [h.student && `${h.student.firstName} ${h.student.lastName}`, h.subject?.name].filter(Boolean).join(" · ") })),
      ...deadlinesTasks.map((k) => ({ id: k.id, kind: "task" as const, title: k.title, date: k.dueDate!, detail: "Tâche" })),
    ].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 8),
    revenueMonths,
    hoursWeeks,
  };
}

/** Productivité et charge de travail sur une période. */
export async function productivity(from: string, to: string) {
  const user = await prisma.user.findFirst();
  const st = readSettings(user?.settings);
  const t = nowParts().date;
  const [done, entries] = await Promise.all([
    prisma.session.findMany({ where: { date: { gte: from, lte: to }, status: "DONE" }, select: { date: true, startTime: true, endTime: true } }),
    prisma.timeEntry.findMany({ where: { date: { gte: from, lte: to } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
  ]);
  const days = new Map<string, Record<string, number>>();
  const add = (d: string, c: string, m: number) => {
    const cur = days.get(d) ?? {};
    cur[c] = (cur[c] ?? 0) + m;
    days.set(d, cur);
  };
  for (const s of done) add(s.date, "TEACHING", duration(s.startTime, s.endTime));
  for (const e of entries) add(e.date, e.category, e.minutes);
  const totals: Record<string, number> = {};
  for (const v of days.values()) for (const [k, m] of Object.entries(v)) totals[k] = (totals[k] ?? 0) + m;

  // Prévision des 7 prochains jours : charge, créneaux libres, pauses suggérées
  const horizon = addDays(t, 6);
  const busy = await busyBlocks(t, horizon);
  const forecast = [];
  for (let d = t; d <= horizon; d = addDays(d, 1)) {
    const dayBusy = busy.filter((b) => b.date === d);
    const teaching = busyMinutes(d, dayBusy.filter((b) => b.kind === "SESSION"));
    forecast.push({
      date: d,
      sessions: dayBusy.filter((b) => b.kind === "SESSION").length,
      teachingMinutes: teaching,
      restMinutes: busyMinutes(d, dayBusy.filter((b) => b.kind === "REST" || b.kind === "BREAK")),
      load: loadLevel(teaching, st.maxDailyHours),
      free: freeSlots(d, dayBusy, d === t && nowParts().time > st.dayStart ? nowParts().time : st.dayStart, st.dayEnd, 45).slice(0, 4),
      breaks: breakSuggestions(dayBusy.filter((b) => b.kind === "SESSION"), st.breakMinutes),
    });
  }
  return {
    from,
    to,
    settings: { maxDailyHours: st.maxDailyHours, dayStart: st.dayStart, dayEnd: st.dayEnd, breakMinutes: st.breakMinutes },
    days: [...days.entries()].sort().map(([date, v]) => ({ date, ...v })),
    totals,
    entries,
    forecast,
    dayLength: toMinutes(st.dayEnd) - toMinutes(st.dayStart),
    dayStartLabel: fromMinutes(toMinutes(st.dayStart)),
  };
}
