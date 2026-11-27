import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { toggleLevelAction, toggleSubjectAction } from "@/actions/admin";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ActionButton } from "@/components/client/ActionButton";
import { EditLevelToggle, EditSubjectToggle, LevelForm, SubjectForm } from "@/components/client/AdminForms";

export default async function CatalogPage() {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const levels = await prisma.educationalLevel.findMany({
    orderBy: { order: "asc" },
    include: { subjects: { orderBy: { order: "asc" }, include: { _count: { select: { courses: true, resources: true } } } }, _count: { select: { students: true } } },
  });
  return (
    <>
      <PageHeader title={a.catalogTitle} subtitle={a.catalogSubtitle} />
      <div className="space-y-6">
        {levels.map((l) => (
          <Card key={l.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{localized(locale, l.name, l.nameAr)}</h2>
                  <Badge tone={l.isActive ? "green" : "gray"}>{l.isActive ? t.common.active : t.common.inactive}</Badge>
                  <Badge>{t.enums.levelCategory[l.category]}</Badge>
                </div>
                <p className="text-xs text-ink-muted" dir="ltr">/{l.slug} · {l._count.students} {t.enums.role.STUDENT.toLowerCase()}</p>
              </div>
              <div className="flex gap-2">
                <ActionButton action={toggleLevelAction.bind(null, l.id)}>{l.isActive ? t.common.inactive : t.common.active}</ActionButton>
              </div>
            </div>
            <EditLevelToggle label={t.common.edit} levelId={l.id} defaults={{ name: l.name, nameAr: l.nameAr ?? "", slug: l.slug, description: l.description ?? "", category: l.category, order: l.order }} />

            <h3 className="mb-2 mt-5 text-sm font-semibold text-ink-muted">{fmt(a.subjectsOf, { level: localized(locale, l.name, l.nameAr) })}</h3>
            {l.subjects.length === 0 ? <p className="text-sm text-ink-muted">{a.noSubjects}</p> : (
              <ul className="divide-y divide-gray-50">
                {l.subjects.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon name={s.icon} className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1 text-sm font-medium">{localized(locale, s.name, s.nameAr)} <span className="text-xs font-normal text-ink-muted">· {s._count.courses} {a.coursesTitle.toLowerCase()} · {s._count.resources} PDF</span></span>
                    {!s.isActive && <Badge>{t.common.inactive}</Badge>}
                    <ActionButton variant="ghost" action={toggleSubjectAction.bind(null, s.id)}>{s.isActive ? t.common.inactive : t.common.active}</ActionButton>
                    <EditSubjectToggle label={t.common.edit} subjectId={s.id} levelId={l.id} defaults={{ levelId: l.id, name: s.name, nameAr: s.nameAr ?? "", slug: s.slug, icon: s.icon ?? "book", description: s.description ?? "", order: s.order }} />
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-4 rounded-xl bg-surface p-4">
              <summary className="cursor-pointer text-sm font-medium text-brand-700">+ {a.newSubject}</summary>
              <div className="mt-4"><SubjectForm levelId={l.id} /></div>
            </details>
          </Card>
        ))}
        <Card>
          <CardTitle>{a.newLevel}</CardTitle>
          <LevelForm />
        </Card>
      </div>
    </>
  );
}
