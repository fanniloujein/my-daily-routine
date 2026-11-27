import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { formatDate } from "@/lib/time";
import { getStudentLevel } from "@/server/content";
import { getStudentProgress } from "@/server/progress";
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar, Table, Td } from "@/components/ui";
import { Icon } from "@/components/icons";

export default async function ProgressPage() {
  const user = await requireUser("STUDENT");
  const { t, locale } = await getI18n();
  const s = t.student;
  const level = await getStudentLevel(user.id);
  const p = await getStudentProgress(user.id, level?.id ?? null);
  const trend = [...p.attempts].reverse().slice(-12);

  if (p.lessonsDone === 0 && p.attempts.length === 0) {
    return (
      <>
        <PageHeader title={s.progressTitle} subtitle={s.progressSubtitle} />
        <EmptyState icon={<TrendingUp className="h-5 w-5" />} title={s.progressEmpty} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={s.progressTitle} subtitle={s.progressSubtitle} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{s.progressBySubject}</CardTitle>
          <ul className="space-y-4">
            {p.bySubject.map((row) => (
              <li key={row.subject.id} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name={row.subject.icon} className="h-[18px] w-[18px]" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{localized(locale, row.subject.name, row.subject.nameAr)}</span>
                    <span className="shrink-0 text-xs text-ink-muted">{fmt(s.progressLessons, { done: row.doneLessons, total: row.totalLessons })}</span>
                  </div>
                  <ProgressBar value={row.totalLessons ? (row.doneLessons / row.totalLessons) * 100 : 0} className="mt-1.5" />
                </div>
                <span className="w-14 shrink-0 text-end text-sm font-semibold">{row.avg !== null ? `${Math.round(row.avg)}%` : "—"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-muted">{s.progressAvg} : {p.avgAll !== null ? `${Math.round(p.avgAll)} %` : "—"}</p>
        </Card>

        <Card>
          <CardTitle>{s.progressTrend}</CardTitle>
          {trend.length === 0 ? <p className="text-sm text-ink-muted">{s.recentResultsEmpty}</p> : (
            <div className="flex h-48 items-end gap-2" role="img" aria-label={s.progressTrend}>
              {trend.map((a) => (
                <div key={a.id} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] text-ink-muted">{Math.round(a.percentage)}</span>
                  <div className={`w-full rounded-t-md ${a.percentage >= a.quiz.passingScore ? "bg-brand-300" : "bg-sun-300"}`} style={{ height: `${Math.max(4, a.percentage) * 1.5}px` }} title={`${a.quiz.title} — ${Math.round(a.percentage)}%`} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>{s.progressRecent}</CardTitle>
        {p.attempts.length === 0 ? <p className="text-sm text-ink-muted">{s.recentResultsEmpty}</p> : (
          <Table head={[t.admin.quizTitle, t.common.date, t.common.total, "%"]}>
            {p.attempts.slice(0, 30).map((a) => (
              <tr key={a.id}>
                <Td><Link href={`/student/quizzes/attempts/${a.id}`} className="font-medium hover:text-brand-700">{a.quiz.title}</Link></Td>
                <Td className="text-ink-muted">{formatDate(a.completedAt, locale)}</Td>
                <Td>{a.score} / {a.maxScore}</Td>
                <Td><Badge tone={a.percentage >= a.quiz.passingScore ? "green" : "yellow"}>{Math.round(a.percentage)} %</Badge></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
