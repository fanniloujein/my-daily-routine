import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { formatDate } from "@/lib/time";
import { getViewer, viewerCan } from "@/server/content";
import { Alert, Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { LockedNotice } from "@/components/content";
import { QuizRunner } from "@/components/client/QuizRunner";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("STUDENT");
  const { t, locale } = await getI18n();
  const s = t.student;
  const { id } = await params;
  const quiz = await prisma.quiz.findFirst({ where: { id, status: "PUBLISHED" }, include: { subject: true } });
  if (!quiz) notFound();
  const allowed = viewerCan(await getViewer(user), quiz.accessLevel, quiz.authorId);
  // Les bonnes réponses (correctOptions) ne sont jamais sélectionnées ici.
  const questions = allowed
    ? await prisma.question.findMany({ where: { quizId: id }, orderBy: { order: "asc" }, select: { id: true, prompt: true, type: true, options: true } })
    : [];
  const attempts = await prisma.quizAttempt.findMany({ where: { quizId: id, userId: user.id }, orderBy: { completedAt: "desc" }, take: 5 });

  return (
    <>
      <PageHeader
        back={<Link href={`/student/subjects/${quiz.subjectId}?tab=quizzes`} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {localized(locale, quiz.subject.name, quiz.subject.nameAr)}</Link>}
        title={quiz.title}
        subtitle={[fmt(s.quizQuestions, { count: questions.length }), quiz.timeLimitMinutes ? fmt(s.quizTimeLimit, { minutes: quiz.timeLimitMinutes }) : null, fmt(s.quizPassing, { score: quiz.passingScore })].filter(Boolean).join(" · ")}
      />
      {quiz.isDemo && <Alert tone="yellow" className="mb-6">{t.common.demoContent}</Alert>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          {!allowed ? <LockedNotice t={t} /> : questions.length === 0 ? <EmptyState title={t.errors.quizEmpty} /> : (
            <QuizRunner quizId={quiz.id} questions={questions.map((q) => ({ ...q, options: (q.options as string[]) ?? [] }))} />
          )}
        </div>
        {attempts.length > 0 && (
          <Card className="h-fit">
            <CardTitle>{s.attemptsTitle}</CardTitle>
            <ul className="space-y-2 text-sm">
              {attempts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <Link href={`/student/quizzes/attempts/${a.id}`} className="text-ink-soft hover:text-brand-700">{formatDate(a.completedAt, locale)}</Link>
                  <Badge tone={a.percentage >= quiz.passingScore ? "green" : "yellow"}>{Math.round(a.percentage)} %</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
