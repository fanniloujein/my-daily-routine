import { prisma } from "@/lib/prisma";

/** Progression d'un élève par matière (leçons terminées + résultats QCM). */
export async function getStudentProgress(userId: string, levelId: string | null) {
  const subjects = levelId
    ? await prisma.subject.findMany({ where: { levelId, isActive: true }, orderBy: { order: "asc" } })
    : [];
  const subjectIds = subjects.map((s) => s.id);

  const [lessons, done, attempts] = await Promise.all([
    prisma.lesson.findMany({
      where: { course: { status: "PUBLISHED", subjectId: { in: subjectIds } } },
      select: { id: true, course: { select: { subjectId: true } } },
    }),
    prisma.lessonProgress.findMany({ where: { userId }, select: { lessonId: true, lesson: { select: { course: { select: { subjectId: true } } } } } }),
    prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
      take: 200,
      include: { quiz: { select: { id: true, title: true, subjectId: true, passingScore: true } } },
    }),
  ]);

  const bySubject = subjects.map((s) => {
    const total = lessons.filter((l) => l.course.subjectId === s.id).length;
    const completed = done.filter((d) => d.lesson.course.subjectId === s.id).length;
    const att = attempts.filter((a) => a.quiz.subjectId === s.id);
    const avg = att.length ? att.reduce((n, a) => n + a.percentage, 0) / att.length : null;
    return { subject: s, totalLessons: total, doneLessons: Math.min(completed, total), attempts: att.length, avg };
  });

  const avgAll = attempts.length ? attempts.reduce((n, a) => n + a.percentage, 0) / attempts.length : null;
  return { bySubject, attempts, lessonsDone: done.length, avgAll };
}
