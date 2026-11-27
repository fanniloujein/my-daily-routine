import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, FileText, ListChecks } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { getStudentLevel, getViewer, viewerCan } from "@/server/content";
import { Badge, EmptyState, PageHeader, ProgressBar, Tabs } from "@/components/ui";
import { ResourceList } from "@/components/ResourceList";

export default async function SubjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser("STUDENT");
  const { t, locale } = await getI18n();
  const s = t.student;
  const { id } = await params;
  const { tab = "courses" } = await searchParams;
  const level = await getStudentLevel(user.id);
  const subject = await prisma.subject.findFirst({ where: { id, isActive: true, ...(level ? { levelId: level.id } : {}) } });
  if (!subject) notFound();
  const viewer = await getViewer(user);

  const [courses, resources, quizzes, done] = await Promise.all([
    prisma.course.findMany({ where: { subjectId: id, status: "PUBLISHED" }, orderBy: { order: "asc" }, include: { lessons: { select: { id: true } } } }),
    prisma.educationalResource.findMany({ where: { subjectId: id, status: "PUBLISHED" }, orderBy: { createdAt: "desc" } }),
    prisma.quiz.findMany({ where: { subjectId: id, status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, include: { _count: { select: { questions: true } } } }),
    prisma.lessonProgress.findMany({ where: { userId: user.id, lesson: { course: { subjectId: id } } }, select: { lessonId: true } }),
  ]);
  const doneSet = new Set(done.map((d) => d.lessonId));
  const base = `/student/subjects/${id}`;

  return (
    <>
      <PageHeader
        back={<Link href="/student/subjects" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {s.subjectsTitle}</Link>}
        title={localized(locale, subject.name, subject.nameAr)}
        subtitle={subject.description ?? undefined}
      />
      <Tabs
        items={[
          { href: `${base}?tab=courses`, label: s.tabCourses, active: tab === "courses", count: courses.length },
          { href: `${base}?tab=resources`, label: s.tabResources, active: tab === "resources", count: resources.length },
          { href: `${base}?tab=quizzes`, label: s.tabQuizzes, active: tab === "quizzes", count: quizzes.length },
        ]}
      />

      {tab === "courses" &&
        (courses.length === 0 ? (
          <EmptyState icon={<BookOpen className="h-5 w-5" />} title={s.coursesEmpty} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {courses.map((c) => {
              const total = c.lessons.length;
              const d = c.lessons.filter((l) => doneSet.has(l.id)).length;
              return (
                <li key={c.id}>
                  <Link href={`/student/courses/${c.id}`} className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-card transition hover:border-brand-200">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={c.accessLevel === "FREE" ? "green" : "gray"}>{t.enums.accessLevel[c.accessLevel]}</Badge>
                      {c.isDemo && <Badge tone="yellow">{t.common.demo}</Badge>}
                    </div>
                    <h2 className="mt-3 font-semibold">{c.title}</h2>
                    {c.summary && <p className="mt-1 text-sm text-ink-muted">{c.summary}</p>}
                    <div className="mt-auto pt-4">
                      <div className="mb-1.5 flex justify-between text-xs text-ink-muted">
                        <span>{fmt(s.lessonsCount, { count: total })}</span>
                        <span>{fmt(s.courseProgress, { done: d, total })}</span>
                      </div>
                      <ProgressBar value={total ? (d / total) * 100 : 0} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "resources" &&
        (resources.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} title={s.resourcesEmpty} />
        ) : (
          <ResourceList items={resources} t={t} locale={locale} canOpen={(r) => viewerCan(viewer, r.accessLevel, r.uploadedById)} />
        ))}

      {tab === "quizzes" &&
        (quizzes.length === 0 ? (
          <EmptyState icon={<ListChecks className="h-5 w-5" />} title={s.quizzesEmpty} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {quizzes.map((q) => (
              <li key={q.id}>
                <Link href={`/student/quizzes/${q.id}`} className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-card transition hover:border-brand-200">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={q.accessLevel === "FREE" ? "green" : "gray"}>{t.enums.accessLevel[q.accessLevel]}</Badge>
                    {q.isDemo && <Badge tone="yellow">{t.common.demo}</Badge>}
                  </div>
                  <h2 className="mt-3 font-semibold">{q.title}</h2>
                  <p className="mt-auto pt-3 text-sm text-ink-muted">{fmt(s.quizQuestions, { count: q._count.questions })}</p>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}
