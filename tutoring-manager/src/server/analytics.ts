// Statistiques pédagogiques et de productivité (les statistiques financières sont dans financeStats).
import { prisma } from "@/lib/db";
import { addDays, duration, monthOf, startOfWeek } from "@/lib/dates";
import { financeStats } from "./financeStats";

export async function analytics(from: string, to: string) {
  const [students, sessions, assessments, entries, levels, subjects, progress] = await Promise.all([
    prisma.student.findMany({ where: { archived: false }, include: { subjects: true } }),
    prisma.session.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true, startTime: true, endTime: true, status: true, subjectId: true } }),
    prisma.assessment.findMany({ where: { date: { gte: from, lte: to } }, include: { student: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { date: "asc" } }),
    prisma.timeEntry.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.level.findMany({ orderBy: { order: "asc" } }),
    prisma.subject.findMany(),
    prisma.studentProgress.groupBy({ by: ["status"], _count: true }),
  ]);
  const byLevel = levels.map((l) => ({ name: l.name, count: students.filter((s) => s.levelId === l.id).length })).filter((x) => x.count);
  const bySubject = subjects.map((s) => ({ name: s.name, color: s.color, count: students.filter((x) => x.subjects.some((y) => y.subjectId === s.id)).length })).filter((x) => x.count);

  const months = new Map<string, { done: number; cancelled: number; absent: number; minutes: number }>();
  for (const s of sessions) {
    const m = monthOf(s.date);
    const cur = months.get(m) ?? { done: 0, cancelled: 0, absent: 0, minutes: 0 };
    if (s.status === "DONE") {
      cur.done++;
      cur.minutes += duration(s.startTime, s.endTime);
    } else if (s.status === "CANCELLED" || s.status === "POSTPONED" || s.status === "TEACHER_ABSENT") cur.cancelled++;
    else if (s.status === "STUDENT_ABSENT") cur.absent++;
    months.set(m, cur);
  }
  const sessionsByMonth = [...months.entries()].sort().map(([month, v]) => ({ month, ...v, hours: Math.round((v.minutes / 60) * 10) / 10 }));

  // Évolution moyenne des résultats (sur 20) par mois et par élève
  const scoreByMonth = new Map<string, number[]>();
  for (const a of assessments) {
    const m = monthOf(a.date);
    scoreByMonth.set(m, [...(scoreByMonth.get(m) ?? []), (Number(a.score) / Number(a.maxScore)) * 20]);
  }
  const progression = [...scoreByMonth.entries()].sort().map(([month, xs]) => ({ month, average: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 }));

  const weekly = new Map<string, Record<string, number>>();
  const add = (d: string, k: string, m: number) => {
    const w = startOfWeek(d);
    const cur = weekly.get(w) ?? {};
    cur[k] = (cur[k] ?? 0) + m;
    weekly.set(w, cur);
  };
  for (const s of sessions.filter((s) => s.status === "DONE")) add(s.date, "TEACHING", duration(s.startTime, s.endTime));
  for (const e of entries) add(e.date, e.category, e.minutes);
  const timeTotals: Record<string, number> = {};
  for (const v of weekly.values()) for (const [k, m] of Object.entries(v)) timeTotals[k] = (timeTotals[k] ?? 0) + m;

  const finance = await financeStats({ from, to });
  return {
    from,
    to,
    pedagogy: {
      students: students.length,
      byLevel,
      bySubject,
      sessionsByMonth,
      hoursTaught: Math.round((sessions.filter((s) => s.status === "DONE").reduce((a, s) => a + duration(s.startTime, s.endTime), 0) / 60) * 10) / 10,
      progression,
      progressStatus: Object.fromEntries(progress.map((p) => [p.status, p._count])),
      assessments: assessments.length,
    },
    finance,
    productivity: {
      weekly: [...weekly.entries()].sort().map(([week, v]) => ({ week, weekEnd: addDays(week, 6), ...Object.fromEntries(Object.entries(v).map(([k, m]) => [k, Math.round((m / 60) * 10) / 10])) })),
      totals: Object.fromEntries(Object.entries(timeTotals).map(([k, m]) => [k, Math.round((m / 60) * 10) / 10])),
    },
  };
}
