import { FileText, Search } from "lucide-react";
import type { Prisma, ResourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { getStudentLevel, getViewer, viewerCan } from "@/server/content";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { ResourceList } from "@/components/ResourceList";
import { Pagination, qs } from "@/components/Pagination";

const TYPES: ResourceType[] = ["REVISION_SHEET", "EXERCISES", "CORRECTION", "SUMMARY", "METHODOLOGY", "OTHER"];
const PER_PAGE = 20;

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string; type?: string; page?: string }> }) {
  const user = await requireUser("STUDENT");
  const { t, locale } = await getI18n();
  const s = t.student;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const type = TYPES.includes(sp.type as ResourceType) ? (sp.type as ResourceType) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const level = await getStudentLevel(user.id);
  const subjects = await prisma.subject.findMany({ where: { isActive: true, ...(level ? { levelId: level.id } : {}) }, orderBy: { order: "asc" } });
  const subjectId = subjects.some((x) => x.id === sp.subject) ? sp.subject : undefined;

  const where: Prisma.EducationalResourceWhereInput = {
    status: "PUBLISHED",
    subjectId: subjectId ?? { in: subjects.map((x) => x.id) },
    ...(type ? { type } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [items, total, viewer] = await Promise.all([
    prisma.educationalResource.findMany({ where, include: { subject: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.educationalResource.count({ where }),
    getViewer(user),
  ]);

  return (
    <>
      <PageHeader title={s.libraryTitle} subtitle={s.librarySubtitle} />
      <form className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-soft sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        <label className="relative">
          <span className="sr-only">{t.common.search}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder={s.librarySearch} className="input ps-9" />
        </label>
        <select name="subject" defaultValue={subjectId ?? ""} className="input" aria-label={s.teachersFilterSubject}>
          <option value="">{s.allSubjects}</option>
          {subjects.map((x) => <option key={x.id} value={x.id}>{localized(locale, x.name, x.nameAr)}</option>)}
        </select>
        <select name="type" defaultValue={type ?? ""} className="input" aria-label={t.admin.resourceType}>
          <option value="">{s.allTypes}</option>
          {TYPES.map((ty) => <option key={ty} value={ty}>{t.enums.resourceType[ty]}</option>)}
        </select>
        <Button type="submit">{t.common.filter}</Button>
      </form>
      {items.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title={s.libraryEmpty} />
      ) : (
        <ResourceList items={items} t={t} locale={locale} canOpen={(r) => viewerCan(viewer, r.accessLevel, r.uploadedById)} />
      )}
      <Pagination t={t} page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => qs("/student/library", { q, subject: subjectId, type, page: p })} />
    </>
  );
}
