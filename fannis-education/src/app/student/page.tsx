import Link from "next/link";
import { BookOpenCheck, CalendarDays, ListChecks, Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { formatDateTime, formatDate } from "@/lib/time";
import { getStudentAccess } from "@/server/subscriptions";
import { getStudentLevel } from "@/server/content";
import { getStudentProgress } from "@/server/progress";
import { Alert, Badge, Card, CardTitle, EmptyState, LinkButton, PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SubscriptionCard } from "@/components/SubscriptionCard";

export default async function StudentDashboard() {
  const user = await requireUser("STUDENT");
  const { t, locale } = await getI18n();
  const s = t.student;
  const level = await getStudentLevel(user.id);
  const now = new Date();
  const [access, progress, upcoming, upcomingCount] = await Promise.all([
    getStudentAccess(user.id, now),
    getStudentProgress(user.id, level?.id ?? null),
    prisma.booking.findMany({
      where: { studentId: user.id, status: { in: ["PENDING", "ACCEPTED"] }, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 3,
      include: { teacher: { include: { user: { select: { name: true } } } }, subject: true },
    }),
    prisma.booking.count({ where: { studentId: user.id, status: { in: ["PENDING", "ACCEPTED"] }, startsAt: { gte: now } } }),
  ]);

  return (
    <>
      <PageHeader title={fmt(s.hello, { name: user.name.split(" ")[0] })} subtitle={s.helloSubtitle} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={s.statLessons} value={progress.lessonsDone} icon={<BookOpenCheck className="h-5 w-5" />} />
        <StatCard label={s.statQuizzes} value={progress.attempts.length} icon={<ListChecks className="h-5 w-5" />} />
        <StatCard label={s.statAverage} value={progress.avgAll !== null ? `${Math.round(progress.avgAll)} %` : "—"} icon={<Target className="h-5 w-5" />} tone="yellow" />
        <StatCard label={s.statSessions} value={upcomingCount} icon={<CalendarDays className="h-5 w-5" />} tone="gray" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardTitle action={<Link href="/student/subjects" className="text-sm font-medium text-brand-700 hover:underline">{t.common.seeAll}</Link>}>{s.continueTitle}</CardTitle>
            {!level ? (
              <Alert tone="yellow" title={s.noLevel} action={<LinkButton href="/student/profile" size="sm">{s.chooseLevel}</LinkButton>} />
            ) : progress.bySubject.length === 0 ? (
              <EmptyState title={s.subjectsEmpty} />
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {progress.bySubject.slice(0, 6).map((p) => (
                  <li key={p.subject.id}>
                    <Link href={`/student/subjects/${p.subject.id}`} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/40">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name={p.subject.icon} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{localized(locale, p.subject.name, p.subject.nameAr)}</p>
                        <ProgressBar value={p.totalLessons ? (p.doneLessons / p.totalLessons) * 100 : 0} className="mt-2" />
                      </div>
                      <span className="text-xs text-ink-muted">{p.doneLessons}/{p.totalLessons}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle action={<Link href="/student/progress" className="text-sm font-medium text-brand-700 hover:underline">{t.common.seeAll}</Link>}>{s.recentResultsTitle}</CardTitle>
            {progress.attempts.length === 0 ? (
              <EmptyState icon={<ListChecks className="h-5 w-5" />} title={s.recentResultsEmpty} />
            ) : (
              <ul className="divide-y divide-gray-50">
                {progress.attempts.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/student/quizzes/attempts/${a.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-brand-700">{a.quiz.title}</Link>
                    <span className="text-xs text-ink-muted">{formatDate(a.completedAt, locale)}</span>
                    <Badge tone={a.percentage >= a.quiz.passingScore ? "green" : "yellow"}>{Math.round(a.percentage)} %</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <SubscriptionCard access={access} t={t} locale={locale} />
          <Card>
            <CardTitle>{s.upcomingTitle}</CardTitle>
            {upcoming.length === 0 ? (
              <div className="text-sm text-ink-muted">
                <p>{s.upcomingEmpty}</p>
                <LinkButton href="/student/teachers" size="sm" variant="secondary" className="mt-3">{s.findTeacher}</LinkButton>
              </div>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((b) => (
                  <li key={b.id} className="rounded-xl bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{localized(locale, b.subject.name, b.subject.nameAr)}</p>
                      <Badge tone={b.status === "ACCEPTED" ? "green" : "yellow"}>{t.enums.bookingStatus[b.status]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{formatDateTime(b.startsAt, locale)} · {t.enums.lessonMode[b.mode]}</p>
                    <p className="text-xs text-ink-muted">{fmt(s.bookingWith, { teacher: b.teacher.user.name })}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
