import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { subjectOptions } from "@/server/admin-options";
import { deleteQuestionAction, deleteQuizAction, setQuizStatusAction } from "@/actions/content";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
import { EditQuestionToggle, QuestionForm, QuizForm } from "@/components/client/ContentForms";
import { STATUS_TONE } from "@/components/CourseEditor";

export default async function AdminQuizPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id }, include: { subject: true, questions: { orderBy: { order: "asc" } } } });
  if (!quiz) notFound();
  return (
    <>
      <PageHeader
        back={<Link href="/admin/quizzes" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {a.quizzesTitle}</Link>}
        title={quiz.title}
        subtitle={<span className="flex flex-wrap items-center gap-2">{localized(locale, quiz.subject.name, quiz.subject.nameAr)} <Badge tone={STATUS_TONE[quiz.status]}>{t.enums.publishStatus[quiz.status]}</Badge></span>}
        actions={
          <>
            {quiz.status !== "PUBLISHED" ? <ActionButton variant="primary" action={setQuizStatusAction.bind(null, quiz.id, "PUBLISHED")}>{a.publish}</ActionButton> : <ActionButton action={setQuizStatusAction.bind(null, quiz.id, "DRAFT")}>{a.unpublish}</ActionButton>}
            <ActionButton variant="danger" confirmText={t.common.confirmAction} action={deleteQuizAction.bind(null, quiz.id)}>{t.common.delete}</ActionButton>
          </>
        }
      />
      <Card className="mb-6">
        <QuizForm
          subjects={await subjectOptions(locale)}
          quizId={quiz.id}
          defaults={{ subjectId: quiz.subjectId, title: quiz.title, description: quiz.description ?? "", accessLevel: quiz.accessLevel, passingScore: quiz.passingScore, timeLimitMinutes: quiz.timeLimitMinutes ?? "", isDemo: quiz.isDemo }}
        />
      </Card>
      <Card>
        <CardTitle>{a.questions}</CardTitle>
        {quiz.questions.length === 0 ? <EmptyState title={a.questionsEmpty} /> : (
          <ol className="divide-y divide-gray-50">
            {quiz.questions.map((q, i) => {
              const options = (q.options as string[]) ?? [];
              return (
                <li key={q.id} className="flex flex-wrap items-start gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i + 1}. {q.prompt} <Badge className="ms-1">{t.enums.questionType[q.type]}</Badge></p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {options.map((o, k) => <li key={k} className={q.correctOptions.includes(k) ? "flex items-center gap-1.5 font-medium text-emerald-700" : "ps-5 text-ink-soft"}>{q.correctOptions.includes(k) && <CheckCircle2 className="h-3.5 w-3.5" />}{o}</li>)}
                    </ul>
                  </div>
                  <EditQuestionToggle quizId={quiz.id} label={t.common.edit} question={{ id: q.id, prompt: q.prompt, type: q.type, options, correct: q.correctOptions, explanation: q.explanation ?? "", points: q.points }} />
                  <ActionButton variant="danger" confirmText={t.common.confirmAction} action={deleteQuestionAction.bind(null, quiz.id, q.id)}>{t.common.delete}</ActionButton>
                </li>
              );
            })}
          </ol>
        )}
        <div className="mt-6 border-t border-gray-100 pt-6">
          <h3 className="mb-4 font-semibold">{a.newQuestion}</h3>
          <QuestionForm quizId={quiz.id} />
        </div>
      </Card>
    </>
  );
}
