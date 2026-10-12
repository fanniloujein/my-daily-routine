import { prisma } from "@/lib/db";
import { addDays, rangeDays, startOfWeek, type DateStr } from "@/lib/dates";
import { GERMAN_TOPICS } from "@/lib/constants";
import { getOccurrences } from "./occurrences";

export type Stats = Awaited<ReturnType<typeof computeStats>>;

export async function computeStats(userId: string, from: DateStr, to: DateStr) {
  const occ = await getOccurrences(userId, from, to);
  const done = occ.filter((o) => o.status === "DONE");
  const postponedCount = occ.filter((o) => o.status === "POSTPONED").length;
  const postponedActivities = await prisma.activity.aggregate({
    where: { userId, updatedAt: { gte: new Date(from) }, postponeCount: { gt: 0 } },
    _count: true,
  });

  const byCategory = new Map<string, { name: string; color: string; minutes: number; count: number; balance: string }>();
  for (const o of done) {
    const c = byCategory.get(o.categoryId) ?? { name: o.category.name, color: o.category.color, minutes: 0, count: 0, balance: o.category.balance };
    c.minutes += o.durationMin;
    c.count += 1;
    byCategory.set(o.categoryId, c);
  }
  const balance = { work: 0, rest: 0, health: 0, personal: 0 } as Record<string, number>;
  for (const c of byCategory.values()) balance[c.balance] = (balance[c.balance] ?? 0) + c.minutes;

  const daily = rangeDays(from, to).map((d) => {
    const day = occ.filter((o) => o.date === d);
    return { date: d, planned: day.length, done: day.filter((o) => o.status === "DONE").length };
  });

  const [lessonsDone, lessonsPlanned, projects, germanSessions, flashReviews, sportSessions, energy] = await Promise.all([
    prisma.lesson.count({ where: { userId, date: { gte: from, lte: to }, status: "DONE" } }),
    prisma.lesson.count({ where: { userId, date: { gte: from, lte: to } } }),
    prisma.project.findMany({ where: { userId, status: { in: ["ACTIVE", "ON_HOLD"] } }, include: { tasks: true } }),
    prisma.germanSession.findMany({ where: { userId, date: { gte: from, lte: to } } }),
    prisma.flashcardReview.findMany({ where: { flashcard: { userId }, reviewedAt: { gte: new Date(from), lte: new Date(addDays(to, 1)) } } }),
    prisma.sportSession.findMany({ where: { userId, date: { gte: from, lte: to } } }),
    prisma.energyCheckin.findMany({ where: { userId, date: { gte: from, lte: to } }, orderBy: { date: "asc" } }),
  ]);

  const prepMinutes = done.filter((o) => o.category.kind === "prep" || o.lessonRole === "prep").reduce((s, o) => s + o.durationMin, 0);
  const germanDone = germanSessions.filter((g) => g.done);
  const germanMinutes = germanDone.reduce((s, g) => s + g.durationMin, 0);
  const germanByTopic: Record<string, { minutes: number; ratingSum: number; ratingCount: number }> = {};
  for (const g of germanDone) {
    const t = (germanByTopic[g.topic] ??= { minutes: 0, ratingSum: 0, ratingCount: 0 });
    t.minutes += g.durationMin;
    if (g.rating) {
      t.ratingSum += g.rating;
      t.ratingCount++;
    }
  }
  const sportDone = sportSessions.filter((s) => s.status === "DONE");

  return {
    from,
    to,
    tasksDone: done.length,
    tasksPlanned: occ.length,
    postponed: postponedCount + postponedActivities._count,
    postponedActivities: postponedActivities._count,
    byCategory: [...byCategory.values()].sort((a, b) => b.minutes - a.minutes),
    balance,
    daily,
    lessonsDone,
    lessonsPlanned,
    prepMinutes,
    projects: projects.map((p) => {
      const total = p.tasks.length;
      const doneT = p.tasks.filter((t) => t.status === "DONE").length;
      return {
        id: p.id,
        name: p.name,
        client: p.client,
        deadline: p.deadline,
        progress: total ? Math.round((doneT / total) * 100) : 0,
        tasksDone: doneT,
        tasksTotal: total,
        estimateMin: p.tasks.reduce((s, t) => s + t.estimateMin, 0),
        spentMin: p.tasks.reduce((s, t) => s + t.spentMin, 0),
        doneThisPeriod: p.tasks.filter((t) => t.doneAt && t.doneAt >= new Date(from)).length,
      };
    }),
    germanMinutes,
    germanSessions: germanDone.length,
    germanByTopic: Object.entries(germanByTopic).map(([topic, v]) => ({
      topic,
      label: GERMAN_TOPICS[topic] ?? topic,
      minutes: v.minutes,
      avgRating: v.ratingCount ? Math.round((v.ratingSum / v.ratingCount) * 10) / 10 : null,
    })),
    flashcardsReviewed: flashReviews.length,
    flashcardSuccess: flashReviews.length ? Math.round((flashReviews.filter((r) => r.grade >= 2).length / flashReviews.length) * 100) : null,
    sportDone: sportDone.length,
    sportMinutes: sportDone.reduce((s, x) => s + x.durationMin, 0),
    sportPlanned: sportSessions.length,
    energy: energy.map((e) => ({ date: e.date, energy: e.energy, mood: e.mood, stress: e.stress })),
  };
}

/** Sujets d'allemand à retravailler : erreurs fréquentes sur les cartes + séances mal notées. */
export async function germanWeakTopics(userId: string) {
  const cards = await prisma.flashcard.findMany({ where: { userId }, select: { topic: true, lapses: true, ease: true, front: true } });
  const sessions = await prisma.germanSession.findMany({ where: { userId, done: true, rating: { not: null } }, orderBy: { date: "desc" }, take: 30 });
  const score: Record<string, number> = {};
  for (const c of cards) score[c.topic] = (score[c.topic] ?? 0) + c.lapses * 2 + (c.ease < 2 ? 2 : 0);
  for (const s of sessions) if (s.rating! <= 2) score[s.topic] = (score[s.topic] ?? 0) + 3;
  const hardCards = cards.filter((c) => c.lapses >= 2 || c.ease < 1.8).slice(0, 8).map((c) => c.front);
  return {
    topics: Object.entries(score)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([topic]) => ({ topic, label: GERMAN_TOPICS[topic] ?? topic })),
    hardCards,
  };
}

/** Bilan hebdomadaire bienveillant (règles locales ; ne juge jamais une semaine comme un échec). */
export async function generateWeeklyReview(userId: string, weekStart: DateStr) {
  const ws = startOfWeek(weekStart);
  const we = addDays(ws, 6);
  const s = await computeStats(userId, ws, we);
  const nextOcc = await getOccurrences(userId, addDays(we, 1), addDays(we, 7));
  const weak = await germanWeakTopics(userId);

  const h = (m: number) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10} h` : `${m} min`);
  const accomplished: string[] = [];
  if (s.tasksDone) accomplished.push(`${s.tasksDone} activité(s) terminée(s) — chacune compte.`);
  if (s.lessonsDone) accomplished.push(`${s.lessonsDone} séance(s) de cours donnée(s)${s.prepMinutes ? `, avec ${h(s.prepMinutes)} de préparation` : ""}.`);
  if (s.germanMinutes) accomplished.push(`${h(s.germanMinutes)} d'allemand (${s.germanSessions} session(s))${s.flashcardsReviewed ? ` et ${s.flashcardsReviewed} carte(s) révisée(s)` : ""}.`);
  if (s.sportDone) accomplished.push(`${s.sportDone} séance(s) de sport, soit ${h(s.sportMinutes)} de mouvement.`);
  const restMin = s.balance.rest ?? 0;
  if (restMin) accomplished.push(`${h(restMin)} de repos et de loisirs : c'est aussi important que le reste.`);
  if (!accomplished.length) accomplished.push("Cette semaine a peut-être été plus calme : se reposer et tenir le cap, c'est déjà avancer.");

  const projects = s.projects
    .filter((p) => p.doneThisPeriod > 0 || p.spentMin > 0)
    .map((p) => `${p.name} (${p.client}) : ${p.progress} % des tâches terminées${p.doneThisPeriod ? `, ${p.doneThisPeriod} cette semaine` : ""}.`);

  const goals: string[] = [];
  const profile = await prisma.sportProfile.findUnique({ where: { userId } });
  if (profile && profile.weeklySessions > 0)
    goals.push(
      s.sportDone >= profile.weeklySessions
        ? `Objectif sport atteint (${s.sportDone}/${profile.weeklySessions}) 🎉`
        : `Sport : ${s.sportDone}/${profile.weeklySessions} séances — chaque séance est une victoire.`,
    );
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const germanGoal = Number((user.settings as Record<string, unknown>)?.germanWeeklyMinutes ?? 120);
  if (germanGoal > 0)
    goals.push(
      s.germanMinutes >= germanGoal
        ? `Objectif allemand atteint (${h(s.germanMinutes)} / ${h(germanGoal)}) 🎉`
        : `Allemand : ${h(s.germanMinutes)} sur ${h(germanGoal)} visées.`,
    );

  const postponed = s.postponed ? [`${s.postponed} activité(s) reportée(s) : elles restent dans ta liste, sans pression.`] : [];

  const priorities: string[] = [];
  const nextLessons = nextOcc.filter((o) => o.lessonRole === "session").length;
  if (nextLessons) priorities.push(`${nextLessons} séance(s) de cours à venir : vérifier les préparations.`);
  for (const p of s.projects.filter((p) => p.deadline && p.deadline <= addDays(we, 14)).slice(0, 3))
    priorities.push(`Projet « ${p.name} » : échéance le ${p.deadline!.split("-").reverse().join("/")}.`);
  if (weak.topics.length) priorities.push(`Allemand : retravailler ${weak.topics.map((t) => t.label.toLowerCase()).join(", ")}.`);
  const urgent = nextOcc.filter((o) => o.priority >= 4 && o.status !== "DONE").slice(0, 3);
  for (const u of urgent) priorities.push(`${u.title} (${u.date.split("-").reverse().slice(0, 2).join("/")}).`);
  if (!priorities.length) priorities.push("Choisir 3 priorités maximum pour la semaine, et garder du temps libre.");

  const suggestions: string[] = [];
  const avgEnergy = s.energy.length ? s.energy.reduce((a, e) => a + e.energy, 0) / s.energy.length : null;
  if (avgEnergy !== null && avgEnergy < 2.6) suggestions.push("Ton énergie a été plutôt basse : prévois des journées légères et des soirées sans écran.");
  if (s.postponed >= 5) suggestions.push("Beaucoup de reports : essaie de découper les grosses tâches en étapes de 30 minutes.");
  if ((s.balance.work ?? 0) > 0 && restMin < (s.balance.work ?? 0) * 0.15) suggestions.push("Garde au moins une soirée entièrement libre pour te ressourcer.");
  if (s.sportDone === 0 && profile?.weeklySessions) suggestions.push("Une marche de 20 minutes compte aussi comme du mouvement.");
  if (!suggestions.length) suggestions.push("Continue ainsi : un rythme régulier vaut mieux qu'une semaine parfaite.");

  const content = { accomplished, projects, goals, postponed, priorities, suggestions, stats: { tasksDone: s.tasksDone, germanMinutes: s.germanMinutes, sportDone: s.sportDone, lessonsDone: s.lessonsDone } };
  return prisma.weeklyReview.upsert({
    where: { userId_weekStart: { userId, weekStart: ws } },
    create: { userId, weekStart: ws, content },
    update: { content },
  });
}
