import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { addDays, startOfWeek, today } from "@/lib/dates";
import { readSettings } from "@/lib/validation";
import { GERMAN_TOPICS } from "@/lib/constants";
import { germanWeakTopics } from "@/server/stats";

/** Progrès des 6 dernières semaines + sujets à retravailler. */
export const GET = route(async ({ user }) => {
  const t = today();
  const ws = startOfWeek(t);
  const weeks = [];
  for (let i = 5; i >= 0; i--) {
    const from = addDays(ws, -7 * i);
    const to = addDays(from, 6);
    const [sessions, reviews] = await Promise.all([
      prisma.germanSession.findMany({ where: { userId: user.id, date: { gte: from, lte: to }, done: true } }),
      prisma.flashcardReview.findMany({ where: { flashcard: { userId: user.id }, reviewedAt: { gte: new Date(`${from}T00:00:00`), lt: new Date(`${addDays(to, 1)}T00:00:00`) } } }),
    ]);
    weeks.push({
      weekStart: from,
      minutes: sessions.reduce((s, x) => s + x.durationMin, 0),
      sessions: sessions.length,
      reviews: reviews.length,
      success: reviews.length ? Math.round((reviews.filter((r) => r.grade >= 2).length / reviews.length) * 100) : null,
    });
  }
  const thisWeek = await prisma.germanSession.findMany({ where: { userId: user.id, date: { gte: ws, lte: addDays(ws, 6) }, done: true } });
  const byTopic = Object.keys(GERMAN_TOPICS).map((k) => ({ topic: k, label: GERMAN_TOPICS[k], minutes: thisWeek.filter((s) => s.topic === k).reduce((a, s) => a + s.durationMin, 0) }));
  const [cardsTotal, cardsDue, cardsMastered] = await Promise.all([
    prisma.flashcard.count({ where: { userId: user.id } }),
    prisma.flashcard.count({ where: { userId: user.id, dueDate: { lte: t } } }),
    prisma.flashcard.count({ where: { userId: user.id, interval: { gte: 21 } } }),
  ]);
  return { weeks, byTopic, weeklyGoal: readSettings(user.settings).germanWeeklyMinutes, cardsTotal, cardsDue, cardsMastered, weak: await germanWeakTopics(user.id) };
});
