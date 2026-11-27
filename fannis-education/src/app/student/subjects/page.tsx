import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { getStudentLevel } from "@/server/content";
import { Alert, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

export default async function SubjectsPage() {
  const user = await requireUser("STUDENT");
  const { t, locale } = await getI18n();
  const s = t.student;
  const level = await getStudentLevel(user.id);
  if (!level) {
    return (
      <>
        <PageHeader title={s.subjectsTitle} />
        <Alert tone="yellow" title={s.noLevel} action={<LinkButton href="/student/profile" size="sm">{s.chooseLevel}</LinkButton>} />
      </>
    );
  }
  const pub = { where: { status: "PUBLISHED" as const } };
  const subjects = await prisma.subject.findMany({
    where: { levelId: level.id, isActive: true },
    orderBy: { order: "asc" },
    include: { _count: { select: { courses: pub, resources: pub, quizzes: pub } } },
  });
  return (
    <>
      <PageHeader title={s.subjectsTitle} subtitle={localized(locale, level.name, level.nameAr)} />
      {subjects.length === 0 ? (
        <EmptyState title={s.subjectsEmpty} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((sub) => (
            <li key={sub.id}>
              <Link href={`/student/subjects/${sub.id}`} className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-card transition hover:border-brand-200">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name={sub.icon} /></span>
                <h2 className="mt-4 font-semibold">{localized(locale, sub.name, sub.nameAr)}</h2>
                <p className="mt-auto pt-3 text-sm text-ink-muted">
                  {fmt(s.coursesCount, { count: sub._count.courses })} · {fmt(s.resourcesCount, { count: sub._count.resources })} · {fmt(s.quizzesCount, { count: sub._count.quizzes })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
