import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { getLessonForViewer, getViewer } from "@/server/content";
import { markLessonDoneAction } from "@/actions/student";
import { Alert, Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { LessonContent, LockedNotice } from "@/components/content";
import { ActionButton } from "@/components/client/ActionButton";

export default async function LessonPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const user = await requireUser("STUDENT");
  const { t } = await getI18n();
  const s = t.student;
  const { id, lessonId } = await params;
  const data = await getLessonForViewer(await getViewer(user), id, lessonId);
  if (!data) notFound();
  const { course, lesson, accessible, content } = data;
  const idx = course.lessons.findIndex((l) => l.id === lesson.id);
  const prev = course.lessons[idx - 1];
  const next = course.lessons[idx + 1];
  const done = accessible && !!(await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } } }));

  return (
    <>
      <PageHeader
        back={<Link href={`/student/courses/${course.id}`} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {course.title}</Link>}
        title={lesson.title}
        subtitle={lesson.durationMinutes ? `${lesson.durationMinutes} ${t.common.minutes}` : undefined}
      />
      {course.isDemo && <Alert tone="yellow" className="mb-6">{t.common.demoContent}</Alert>}
      {accessible && content !== null ? (
        <Card className="max-w-3xl">
          <LessonContent content={content} />
          <div className="mt-8 border-t border-gray-100 pt-5">
            {done ? (
              <Badge tone="green" className="px-3 py-1.5 text-sm"><CheckCircle2 className="h-4 w-4" /> {s.lessonDone}</Badge>
            ) : (
              <ActionButton action={markLessonDoneAction.bind(null, course.id, lesson.id)} variant="primary" size="md" successText={s.lessonDone}>
                <CheckCircle2 className="h-4 w-4" /> {s.markDone}
              </ActionButton>
            )}
          </div>
        </Card>
      ) : (
        <div className="max-w-3xl"><LockedNotice t={t} /></div>
      )}
      <div className="mt-6 flex max-w-3xl justify-between gap-3">
        {prev ? <LinkButton variant="secondary" href={`/student/courses/${course.id}/lessons/${prev.id}`}><ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {s.prevLesson}</LinkButton> : <span />}
        {next && <LinkButton variant="secondary" href={`/student/courses/${course.id}/lessons/${next.id}`}>{s.nextLesson} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" /></LinkButton>}
      </div>
    </>
  );
}
