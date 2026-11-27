import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import type { CurrentUser } from "@/lib/auth/session";
import { deleteCourseAction, deleteLessonAction, moveLessonAction, setCourseStatusAction } from "@/actions/content";
import { Alert, Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
import { CourseForm, EditLessonToggle, LessonForm } from "@/components/client/ContentForms";

export const STATUS_TONE = { DRAFT: "yellow", PUBLISHED: "green", ARCHIVED: "gray" } as const;

export async function CourseEditor({ user, courseId, backHref, subjectOptions }: { user: CurrentUser; courseId: string; backHref: string; subjectOptions: { id: string; label: string }[] }) {
  const { t, locale } = await getI18n();
  const a = t.admin;
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { subject: true, lessons: { orderBy: { order: "asc" } } } });
  if (!course) notFound();
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && course.authorId !== user.id) notFound();
  const editable = isAdmin || course.status === "DRAFT";

  return (
    <>
      <PageHeader
        back={<Link href={backHref} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t.common.back}</Link>}
        title={course.title}
        subtitle={<span className="flex flex-wrap items-center gap-2">{localized(locale, course.subject.name, course.subject.nameAr)} <Badge tone={STATUS_TONE[course.status]}>{t.enums.publishStatus[course.status]}</Badge>{course.isDemo && <Badge tone="yellow">{t.common.demo}</Badge>}</span>}
        actions={
          <>
            {isAdmin && course.status !== "PUBLISHED" && <ActionButton variant="primary" action={setCourseStatusAction.bind(null, course.id, "PUBLISHED")}>{a.publish}</ActionButton>}
            {isAdmin && course.status === "PUBLISHED" && <ActionButton action={setCourseStatusAction.bind(null, course.id, "DRAFT")}>{a.unpublish}</ActionButton>}
            {isAdmin && course.status !== "ARCHIVED" && <ActionButton action={setCourseStatusAction.bind(null, course.id, "ARCHIVED")}>{a.archive}</ActionButton>}
            {editable && <ActionButton variant="danger" confirmText={t.common.confirmAction} action={deleteCourseAction.bind(null, course.id)}>{t.common.delete}</ActionButton>}
          </>
        }
      />
      {!isAdmin && course.status === "DRAFT" && <Alert tone="yellow" className="mb-6">{t.teacher.awaitingReview}</Alert>}
      {!editable && <Alert tone="gray" className="mb-6">{t.errors.forbidden}</Alert>}

      {editable && (
        <Card className="mb-6">
          <CourseForm
            subjects={subjectOptions}
            isAdmin={isAdmin}
            redirectBase={backHref}
            courseId={course.id}
            defaults={{ subjectId: course.subjectId, title: course.title, summary: course.summary ?? "", accessLevel: course.accessLevel, isDemo: course.isDemo }}
          />
        </Card>
      )}

      <Card>
        <CardTitle>{a.lessonsTitle}</CardTitle>
        {course.lessons.length === 0 ? <EmptyState title={a.lessonsEmpty} /> : (
          <ol className="divide-y divide-gray-50">
            {course.lessons.map((l, i) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 py-3">
                <span className="w-6 text-sm text-ink-muted">{i + 1}.</span>
                <span className="min-w-0 flex-1 font-medium">{l.title}</span>
                <Badge tone={l.accessLevel === "FREE" ? "green" : "gray"}>{t.enums.accessLevel[l.accessLevel]}</Badge>
                {editable && (
                  <>
                    <ActionButton variant="ghost" action={moveLessonAction.bind(null, course.id, l.id, "up")}><ArrowUp className="h-4 w-4" aria-label="↑" /></ActionButton>
                    <ActionButton variant="ghost" action={moveLessonAction.bind(null, course.id, l.id, "down")}><ArrowDown className="h-4 w-4" aria-label="↓" /></ActionButton>
                    <EditLessonToggle courseId={course.id} lesson={l} label={t.common.edit} />
                    <ActionButton variant="danger" confirmText={t.common.confirmAction} action={deleteLessonAction.bind(null, course.id, l.id)}>{t.common.delete}</ActionButton>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
        {editable && (
          <div className="mt-6 border-t border-gray-100 pt-6">
            <h3 className="mb-4 font-semibold">{a.newLesson}</h3>
            <LessonForm courseId={course.id} />
          </div>
        )}
      </Card>
    </>
  );
}
