import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { getMyTeacherProfile } from "@/server/teacher";
import { deleteResourceAction } from "@/actions/content";
import { Alert, Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
import { CourseForm, ResourceUploadForm } from "@/components/client/ContentForms";
import { STATUS_TONE } from "@/components/CourseEditor";

export default async function TeacherContentPage() {
  const user = await requireUser("TEACHER");
  const { t, locale } = await getI18n();
  const tt = t.teacher;
  const profile = await getMyTeacherProfile(user.id);
  const subjects = profile.subjects.map((s) => ({ id: s.subjectId, label: localized(locale, s.subject.name, s.subject.nameAr) }));
  const [courses, resources] = await Promise.all([
    prisma.course.findMany({ where: { authorId: user.id }, orderBy: { updatedAt: "desc" }, include: { subject: true, _count: { select: { lessons: true } } } }),
    prisma.educationalResource.findMany({ where: { uploadedById: user.id }, orderBy: { createdAt: "desc" }, include: { subject: true } }),
  ]);
  const approved = profile.status === "APPROVED";

  return (
    <>
      <PageHeader title={tt.contentTitle} subtitle={tt.contentSubtitle} />
      {!approved && <Alert tone="yellow" className="mb-6">{t.errors.teacherNotApproved}</Alert>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{t.admin.coursesTitle}</CardTitle>
          {courses.length === 0 ? <EmptyState title={tt.contentEmpty} /> : (
            <ul className="divide-y divide-gray-50">
              {courses.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/teacher/content/courses/${c.id}`} className="font-medium hover:text-brand-700">{c.title}</Link>
                    <p className="text-xs text-ink-muted">{localized(locale, c.subject.name, c.subject.nameAr)} · {c._count.lessons} {t.admin.lessons.toLowerCase()}</p>
                  </div>
                  <Badge tone={STATUS_TONE[c.status]}>{c.status === "DRAFT" ? tt.awaitingReview : t.enums.publishStatus[c.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
          {approved && subjects.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <h3 className="mb-4 font-semibold">{tt.newCourse}</h3>
              <CourseForm subjects={subjects} isAdmin={false} redirectBase="/teacher/content/courses" />
            </div>
          )}
        </Card>
        <Card>
          <CardTitle>{t.admin.resourcesTitle}</CardTitle>
          {resources.length === 0 ? <EmptyState title={tt.contentEmpty} /> : (
            <ul className="divide-y divide-gray-50">
              {resources.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <a href={`/api/resources/${r.id}/download`} className="font-medium hover:text-brand-700">{r.title}</a>
                    <p className="text-xs text-ink-muted">{localized(locale, r.subject.name, r.subject.nameAr)} · {t.enums.resourceType[r.type]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[r.status]}>{r.status === "DRAFT" ? tt.awaitingReview : t.enums.publishStatus[r.status]}</Badge>
                    {r.status === "DRAFT" && <ActionButton variant="danger" confirmText={t.common.confirmAction} action={deleteResourceAction.bind(null, r.id)}>{t.common.delete}</ActionButton>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {approved && subjects.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <h3 className="mb-4 font-semibold">{tt.newResource}</h3>
              <ResourceUploadForm subjects={subjects} courses={courses.map((c) => ({ id: c.id, label: c.title, subjectId: c.subjectId }))} isAdmin={false} />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
