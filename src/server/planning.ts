import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, nowTime, startOfWeek, timeToMin, today, weekday, type DateStr } from "@/lib/dates";
import { planDay, type PlanBlock, type PlanResult } from "@/lib/planner";
import { readSettings } from "@/lib/validation";
import { getOccurrences, patchOccurrence } from "./occurrences";
import { categoryForKind } from "./categories";
import { GERMAN_OBJECTIVES } from "@/lib/constants";

export async function buildPlan(user: User, date: DateStr, opts: { energy?: number; light?: boolean }): Promise<PlanResult> {
  const settings = readSettings(user.settings);
  const checkin = await prisma.energyCheckin.findUnique({ where: { userId_date: { userId: user.id, date } } });
  const energy = opts.energy ?? checkin?.energy ?? 3;

  const occ = await getOccurrences(user.id, date, date);
  const open = occ.filter((o) => o.status !== "DONE" && o.status !== "POSTPONED");
  const fixed = open.filter((o) => o.startTime && o.endTime);

  // Tâches flexibles : sans horaire aujourd'hui + tâches non datées en retard (jusqu'à 14 jours)
  const overdue = (await getOccurrences(user.id, addDays(date, -14), addDays(date, -1))).filter(
    (o) => !o.startTime && o.status !== "DONE" && o.status !== "POSTPONED" && !o.isRecurring,
  );
  const flexible = [...open.filter((o) => !o.startTime), ...overdue];

  // Objectifs de la semaine
  const ws = startOfWeek(date);
  const we = addDays(ws, 6);
  const [germanDone, sportProfile, sportWeek] = await Promise.all([
    prisma.germanSession.aggregate({ where: { userId: user.id, date: { gte: ws, lte: we } }, _sum: { durationMin: true } }),
    prisma.sportProfile.findUnique({ where: { userId: user.id } }),
    prisma.sportSession.count({ where: { userId: user.id, date: { gte: ws, lte: we }, status: { in: ["DONE", "PLANNED"] } } }),
  ]);
  const hasSportToday = occ.some((o) => o.category.kind === "sport");
  const hasGermanToday = occ.some((o) => o.category.kind === "german");

  return planDay({
    date,
    energy,
    light: opts.light,
    settings,
    notBefore: date === today() ? nowTime() : undefined,
    fixed: fixed.map((o) => ({ id: o.id, title: o.title, startTime: o.startTime, endTime: o.endTime, categoryKind: o.category.kind })),
    tasks: flexible.map((o) => ({
      id: o.id,
      occurrenceDate: o.originalDate,
      title: o.title,
      durationMin: o.durationMin,
      priority: o.priority,
      energyCost: o.energyCost,
      dueDate: o.dueDate ?? (o.date < date ? o.date : null),
      categoryKind: o.category.kind,
      postponeCount: o.postponeCount,
    })),
    goals: {
      germanMinutesLeft: hasGermanToday ? 0 : Math.max(0, settings.germanWeeklyMinutes - (germanDone._sum.durationMin ?? 0)),
      sportSessionsLeft: hasSportToday ? 0 : Math.max(0, (sportProfile?.weeklySessions ?? 0) - sportWeek),
      sportDuration: sportProfile?.defaultDuration ?? 45,
      sportDayAvailable: !!sportProfile && sportProfile.availableDays.includes(weekday(date)),
      sportPreferredTime: sportProfile?.preferredTime,
    },
  });
}

/** Applique une proposition (éventuellement modifiée par l'utilisatrice). */
export async function applyPlan(
  user: User,
  date: DateStr,
  blocks: PlanBlock[],
  postponed: { id: string; occurrenceDate: DateStr }[],
) {
  let updated = 0;
  let created = 0;
  // Regrouper les parties d'une même tâche
  const byTask = new Map<string, PlanBlock[]>();
  for (const b of blocks) {
    if (b.kind !== "task" || !b.refId) continue;
    const k = `${b.refId}|${b.occurrenceDate}`;
    byTask.set(k, [...(byTask.get(k) ?? []), b]);
  }

  for (const [k, parts] of byTask) {
    const [id, occDate] = k.split("|");
    const activity = await prisma.activity.findFirst({ where: { id, userId: user.id } });
    if (!activity) continue;
    parts.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
    const first = parts[0];
    if (activity.recurrence === "NONE") {
      await prisma.activity.update({
        where: { id },
        data: {
          date,
          startTime: first.startTime,
          endTime: first.endTime,
          durationMin: timeToMin(first.endTime) - timeToMin(first.startTime),
        },
      });
    } else {
      await patchOccurrence(user.id, id, occDate, { newDate: date, startTime: first.startTime, endTime: first.endTime });
    }
    updated++;
    // Les parties suivantes deviennent des activités distinctes
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      await prisma.activity.create({
        data: {
          userId: user.id,
          categoryId: activity.categoryId,
          title: `${activity.title} (suite ${i + 1}/${parts.length})`,
          date,
          startTime: p.startTime,
          endTime: p.endTime,
          durationMin: timeToMin(p.endTime) - timeToMin(p.startTime),
          priority: activity.priority,
          energyCost: activity.energyCost,
          dueDate: activity.dueDate,
          reminders: activity.reminders,
          projectTaskId: activity.projectTaskId,
          lessonId: activity.lessonId,
          lessonRole: activity.lessonRole === "session" ? null : activity.lessonRole,
        },
      });
      created++;
    }
    // Si la tâche est tronquée (énergie basse), le reste est conservé dans une activité sans horaire
    const planned = parts.reduce((s, p) => s + timeToMin(p.endTime) - timeToMin(p.startTime), 0);
    if (activity.recurrence === "NONE" && planned < activity.durationMin - 5) {
      await prisma.activity.create({
        data: {
          userId: user.id,
          categoryId: activity.categoryId,
          title: `${activity.title} (reste)`,
          date: addDays(date, 1),
          durationMin: activity.durationMin - planned,
          priority: activity.priority,
          energyCost: activity.energyCost,
          dueDate: activity.dueDate,
          projectTaskId: activity.projectTaskId,
        },
      });
      created++;
    }
  }

  // Suggestions acceptées (allemand / sport)
  for (const b of blocks.filter((x) => x.kind === "suggestion")) {
    const dur = timeToMin(b.endTime) - timeToMin(b.startTime);
    if (b.suggestion === "german") {
      const cat = await categoryForKind(user.id, "german");
      const objective = GERMAN_OBJECTIVES.VOCAB[0];
      const session = await prisma.germanSession.create({
        data: { userId: user.id, date, startTime: b.startTime, durationMin: [15, 30, 45, 60].includes(dur) ? dur : 30, topic: "VOCAB", objective },
      });
      await prisma.activity.create({
        data: { userId: user.id, categoryId: cat.id, title: `Allemand — ${objective}`, date, startTime: b.startTime, endTime: b.endTime, durationMin: dur, germanSessionId: session.id, reminders: [10] },
      });
      created++;
    } else if (b.suggestion === "sport") {
      const cat = await categoryForKind(user.id, "sport");
      const profile = await prisma.sportProfile.findUnique({ where: { userId: user.id } });
      const type = profile?.preferred[0] ?? "Séance de sport";
      const session = await prisma.sportSession.create({ data: { userId: user.id, date, startTime: b.startTime, durationMin: dur, type } });
      await prisma.activity.create({
        data: { userId: user.id, categoryId: cat.id, title: `Sport — ${type}`, date, startTime: b.startTime, endTime: b.endTime, durationMin: dur, sportSessionId: session.id, reminders: [30] },
      });
      created++;
    }
  }

  let moved = 0;
  for (const p of postponed) {
    await postponeOccurrence(user.id, p.id, p.occurrenceDate);
    moved++;
  }
  return { updated, created, postponed: moved };
}

/** Reporte une occurrence au lendemain (en conservant l'horaire seulement si c'est un rendez-vous fixe). */
export async function postponeOccurrence(userId: string, id: string, occurrenceDate: DateStr, toDate?: DateStr) {
  const a = await prisma.activity.findFirst({ where: { id, userId } });
  if (!a) return null;
  if (a.recurrence === "NONE") {
    const target = toDate ?? addDays(a.date < today() ? today() : a.date, 1);
    return prisma.activity.update({
      where: { id },
      data: {
        date: target,
        startTime: a.isFixed ? a.startTime : null,
        endTime: a.isFixed ? a.endTime : null,
        status: "TODO",
        postponeCount: { increment: 1 },
      },
    });
  }
  // Récurrente : on marque cette occurrence comme reportée (la suivante viendra naturellement)
  await prisma.activity.update({ where: { id }, data: { postponeCount: { increment: 1 } } });
  if (toDate) return patchOccurrence(userId, id, occurrenceDate, { newDate: toDate, startTime: null, endTime: null });
  return patchOccurrence(userId, id, occurrenceDate, { status: "POSTPONED" });
}
