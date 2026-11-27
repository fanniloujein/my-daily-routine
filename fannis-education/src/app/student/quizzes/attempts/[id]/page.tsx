import { notFound } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { Card, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import { cn } from "@/components/ui/cn";

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("STUDENT");
  const { t } = await getI18n();
  const s = t.student;
  const { id } = await params;
  // Seul l'auteur de la tentative peut voir la correction.
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id, userId: user.id },
    include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
  if (!attempt) notFound();
  const answers = (attempt.answers ?? {}) as Record<string, number[]>;
  const passed = attempt.percentage >= attempt.quiz.passingScore;

  return (
    <>
      <PageHeader title={`${s.resultTitle} — ${attempt.quiz.title}`} />
      <Card className={cn("mb-6", passed ? "bg-gradient-to-br from-white to-emerald-50" : "bg-gradient-to-br from-white to-sun-50")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-4xl font-bold">{Math.round(attempt.percentage)} %</p>
            <p className="text-sm text-ink-muted">{fmt(s.resultScore, { score: attempt.score, max: attempt.maxScore })}</p>
            <p className="mt-2 font-medium">{passed ? s.resultPassed : s.resultFailed}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/student/quizzes/${attempt.quizId}`}>{s.resultRetry}</LinkButton>
            <LinkButton href={`/student/subjects/${attempt.quiz.subjectId}?tab=quizzes`} variant="secondary">{s.resultBack}</LinkButton>
          </div>
        </div>
        <ProgressBar value={attempt.percentage} className="mt-5" tone={passed ? "blue" : "yellow"} />
      </Card>
      <ol className="space-y-4">
        {attempt.quiz.questions.map((q, i) => {
          const options = (q.options as string[]) ?? [];
          const given = answers[q.id] ?? [];
          const correct = given.length === q.correctOptions.length && [...given].sort().every((v, k) => v === [...q.correctOptions].sort()[k]);
          return (
            <li key={q.id}>
              <Card>
                <div className="flex items-start gap-3">
                  {correct ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-label={s.resultCorrect} /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-label={s.resultIncorrect} />}
                  <div className="flex-1">
                    <p className="font-medium">{i + 1}. {q.prompt}</p>
                    <ul className="mt-3 space-y-1.5 text-sm">
                      {options.map((o, k) => {
                        const isRight = q.correctOptions.includes(k);
                        const chosen = given.includes(k);
                        return (
                          <li key={k} className={cn("rounded-lg px-3 py-2", isRight ? "bg-emerald-50 text-emerald-800" : chosen ? "bg-red-50 text-red-700" : "text-ink-soft")}>
                            {chosen ? "● " : "○ "}{o}
                          </li>
                        );
                      })}
                    </ul>
                    {q.explanation && <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-ink-soft"><span className="font-medium text-ink">{s.resultExplanation} : </span>{q.explanation}</p>}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
    </>
  );
}
