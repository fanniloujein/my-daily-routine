// « Organiser ma semaine » : vue globale, charge, conflits, créneaux libres et suggestions.
import { prisma } from "@/lib/db";
import { readSettings } from "@/lib/settings";
import { addDays, duration, longDate, rangeDates, weekday } from "@/lib/dates";
import { breakSuggestions, busyMinutes, expandWeekly, freeSlots, loadLevel, overlaps, LOAD_LABELS } from "@/lib/schedule";
import { fromMil, toMil, formatDT } from "@/lib/money";
import { FREEING_STATUSES, sessionInclude } from "./schedule";

export async function organizeWeek(ws: string) {
  const we = addDays(ws, 6);
  const user = await prisma.user.findFirst();
  const st = readSettings(user?.settings);
  const [sessions, events, availability, tasks] = await Promise.all([
    prisma.session.findMany({ where: { date: { gte: ws, lte: we } }, include: sessionInclude, orderBy: [{ date: "asc" }, { startTime: "asc" }] }),
    prisma.personalEvent.findMany({ where: { date: { lte: we }, OR: [{ weeklyUntil: null, date: { gte: ws } }, { weeklyUntil: { gte: ws } }] } }),
    prisma.availability.findMany(),
    prisma.task.findMany({ where: { dueDate: { gte: ws, lte: we }, status: { in: ["TODO", "IN_PROGRESS"] } } }),
  ]);
  const active = sessions.filter((s) => !FREEING_STATUSES.includes(s.status as (typeof FREEING_STATUSES)[number]));
  const evs = expandWeekly(events, ws, we);
  const students = new Map<string, { id: string; name: string; count: number }>();
  for (const s of active)
    for (const p of s.participants) {
      const cur = students.get(p.studentId) ?? { id: p.studentId, name: `${p.student.firstName} ${p.student.lastName}`, count: 0 };
      cur.count++;
      students.set(p.studentId, cur);
    }

  const days = rangeDates(ws, we).map((d) => {
    const ds = active.filter((s) => s.date === d);
    const de = evs.filter((e) => e.date === d);
    const blocks = [...ds.map((s) => ({ id: s.id, date: d, startTime: s.startTime, endTime: s.endTime })), ...de.map((e) => ({ id: `e${e.id}`, date: d, startTime: e.startTime, endTime: e.endTime }))];
    const conflicts: [string, string][] = [];
    for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) if (overlaps(blocks[i], blocks[j])) conflicts.push([blocks[i].id!, blocks[j].id!]);
    const teaching = busyMinutes(d, ds);
    return {
      date: d,
      sessions: sessions.filter((s) => s.date === d),
      events: de,
      tasks: tasks.filter((k) => k.dueDate === d),
      availability: availability.filter((a) => a.weekday === weekday(d)),
      teachingMinutes: teaching,
      load: loadLevel(teaching, st.maxDailyHours),
      free: freeSlots(d, blocks, st.dayStart, st.dayEnd, 45),
      breaks: breakSuggestions(ds, st.breakMinutes),
      conflicts,
      unprepared: ds.filter((s) => !s.prepared && s.status === "PLANNED").length,
      hasRest: de.some((e) => e.kind === "REST" || e.kind === "BREAK"),
    };
  });

  const suggestions: { tone: "info" | "warning" | "danger"; text: string }[] = [];
  for (const d of days) {
    if (d.conflicts.length) suggestions.push({ tone: "danger", text: `${longDate(d.date, false)} : ${d.conflicts.length} conflit(s) horaire(s) à résoudre.` });
    if (d.load === "OVERLOADED") suggestions.push({ tone: "danger", text: `${longDate(d.date, false)} est surchargé (${Math.round(d.teachingMinutes / 6) / 10} h de cours pour ${st.maxDailyHours} h souhaitées) : déplacez une séance vers un jour léger.` });
    if (d.breaks.length) suggestions.push({ tone: "warning", text: `${longDate(d.date, false)} : ${d.breaks.length} enchaînement(s) sans pause de ${st.breakMinutes} min (après ${d.breaks.map((b) => b.after).join(", ")}).` });
    if (d.unprepared) suggestions.push({ tone: "warning", text: `${longDate(d.date, false)} : ${d.unprepared} séance(s) à préparer.` });
  }
  const light = days.filter((d) => d.load === "LIGHT" && d.free.length).map((d) => longDate(d.date, false));
  if (light.length) suggestions.push({ tone: "info", text: `Jours légers, idéaux pour préparer vos cours ou vous reposer : ${light.join(", ")}.` });
  if (!days.some((d) => d.hasRest)) suggestions.push({ tone: "info", text: "Aucune période de repos n'est planifiée cette semaine : pensez à en bloquer une." });

  const expected = active.reduce((a, s) => a + s.participants.reduce((b, p) => b + toMil(p.price), 0), 0);
  return {
    weekStart: ws,
    weekEnd: we,
    days,
    students: [...students.values()].sort((a, b) => a.name.localeCompare(b.name)),
    totals: {
      sessions: active.length,
      teachingHours: Math.round((active.reduce((a, s) => a + duration(s.startTime, s.endTime), 0) / 60) * 10) / 10,
      unprepared: active.filter((s) => !s.prepared && s.status === "PLANNED").length,
      expectedRevenue: fromMil(expected),
      expectedRevenueLabel: formatDT(fromMil(expected)),
    },
    suggestions,
    loadLabels: LOAD_LABELS,
  };
}
