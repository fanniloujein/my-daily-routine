import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { subjectOptions } from "@/server/admin-options";
import { Badge, Card, CardTitle, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { QuizForm } from "@/components/client/ContentForms";
import { STATUS_TONE } from "@/components/CourseEditor";

export default async function AdminQuizzesPage() {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const [quizzes, options] = await Promise.all([
    prisma.quiz.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }], include: { subject: true, _count: { select: { questions: true, attempts: true } } } }),
    subjectOptions(locale),
  ]);
  return (
    <>
      <PageHeader title={a.quizzesTitle} subtitle={a.quizzesSubtitle} />
      <Card className="mb-6">
        {quizzes.length === 0 ? <EmptyState title={a.quizzesEmpty} /> : (
          <Table head={[a.quizTitle, a.subject, a.questions, a.access, t.common.status]}>
            {quizzes.map((q) => (
              <tr key={q.id}>
                <Td><Link href={`/admin/quizzes/${q.id}`} className="font-medium hover:text-brand-700">{q.title}</Link>{q.isDemo && <Badge tone="yellow" className="ms-2">{t.common.demo}</Badge>}<span className="block text-xs text-ink-muted">{fmt(a.attempts, { count: q._count.attempts })}</span></Td>
                <Td>{localized(locale, q.subject.name, q.subject.nameAr)}</Td>
                <Td>{q._count.questions}</Td>
                <Td><Badge tone={q.accessLevel === "FREE" ? "green" : "gray"}>{t.enums.accessLevel[q.accessLevel]}</Badge></Td>
                <Td><Badge tone={STATUS_TONE[q.status]}>{t.enums.publishStatus[q.status]}</Badge></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card>
        <CardTitle>{a.newQuiz}</CardTitle>
        <QuizForm subjects={options} />
      </Card>
    </>
  );
}
