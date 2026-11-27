import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { getViewer, lessonAccessible } from "@/server/content";
import { Alert, Badge, Card, LinkButton, PageHeader, ProgressBar } from "@/components/ui";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("STUDENT");
  const { t, locale } = await getI18n();
  const s = t.student;
  const { id } = await params;
  const course = await prisma.course.findFirst({
    where: { id, status: "PUBLISHED" },
    include: { subject: true, lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, accessLevel: true, durationMinutes: true } } },
  });
  if (!course) notFound();
  const viewer = await getViewer(user);
  const done = new Set(
    (await prisma.lessonProgress.findMany({ where: { userId: user.id, lessonId: { in: course.lessons.map((l) => l.id) } }, select: { lessonId: true } })).map((d) => d.lessonId),
  );
  const next = course.lessons.find((l) => !done.has(l.id) && lessonAccessible(viewer, course, l)) ?? course.lessons[0];
  const anyLocked = course.lessons.some((l) => !lessonAccessible(viewer, course, l));

  return (
    <>
      <PageHeader
        back={<Link href={`/student/subjects/${course.subjectId}`} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {localized(locale, course.subject.name, course.subject.nameAr)}</Link>}
        title={course.title}
        subtitle={course.summary ?? undefined}
        actions={next ? <LinkButton href={`/student/courses/${course.id}/lessons/${next.id}`}>{done.size ? s.continueCourse : s.startCourse}</LinkButton> : undefined}
      />
      {course.isDemo && <Alert tone="yellow" className="mb-6">{t.common.demoContent}</Alert>}
      <Card>
        <div className="mb-5">
          <div className="mb-1.5 text-sm text-ink-muted">{fmt(s.courseProgress, { done: done.size, total: course.lessons.length })}</div>
          <ProgressBar value={course.lessons.length ? (done.size / course.lessons.length) * 100 : 0} />
        </div>
        <ol className="divide-y divide-gray-50">
          {course.lessons.map((l, i) => {
            const open = lessonAccessible(viewer, course, l);
            return (
              <li key={l.id}>
                <Link href={`/student/courses/${course.id}/lessons/${l.id}`} className="flex items-center gap-3 py-3.5 hover:text-brand-700">
                  {done.has(l.id) ? <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-500" aria-label={s.lessonDone} /> : open ? <Circle className="h-5 w-5 shrink-0 text-gray-300" aria-hidden /> : <Lock className="h-5 w-5 shrink-0 text-sun-500" aria-label={s.lessonLocked} />}
                  <span className="text-sm text-ink-muted">{i + 1}.</span>
                  <span className="flex-1 text-sm font-medium">{l.title}</span>
                  {l.accessLevel === "FREE" && course.accessLevel === "PREMIUM" && <Badge tone="green">{s.freePreview}</Badge>}
                  {l.durationMinutes && <span className="hidden text-xs text-ink-muted sm:inline">{l.durationMinutes} {t.common.minutes}</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </Card>
      {anyLocked && (
        <Alert tone="yellow" className="mt-6" title={t.common.lockedTitle} action={<LinkButton href="/student/subscription" size="sm" variant="sun">{t.common.subscribeCta}</LinkButton>}>
          {t.common.lockedBody}
        </Alert>
      )}
    </>
  );
}
