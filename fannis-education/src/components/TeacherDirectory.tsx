import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { listPublicTeachers } from "@/server/catalog";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { TeacherCard } from "@/components/TeacherCard";

export async function TeacherDirectory({ base, searchParams }: { base: string; searchParams: { subject?: string; mode?: string; city?: string } }) {
  const { t, locale } = await getI18n();
  const s = t.student;
  const mode = searchParams.mode === "ONLINE" || searchParams.mode === "IN_PERSON" ? searchParams.mode : undefined;
  const city = (searchParams.city ?? "").trim().slice(0, 60);
  const subjects = await prisma.subject.findMany({ where: { isActive: true, level: { isActive: true } }, orderBy: [{ level: { order: "asc" } }, { order: "asc" }] });
  const subjectId = subjects.some((x) => x.id === searchParams.subject) ? searchParams.subject : undefined;
  const teachers = await listPublicTeachers({ subjectId, mode, city: city || undefined });

  return (
    <>
      <PageHeader title={s.teachersTitle} subtitle={s.teachersSubtitle} />
      <form className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-soft sm:grid-cols-[1fr_1fr_1fr_auto]">
        <select name="subject" defaultValue={subjectId ?? ""} className="input" aria-label={s.teachersFilterSubject}>
          <option value="">{s.allSubjects}</option>
          {subjects.map((x) => <option key={x.id} value={x.id}>{localized(locale, x.name, x.nameAr)}</option>)}
        </select>
        <select name="mode" defaultValue={mode ?? ""} className="input" aria-label={s.teachersFilterMode}>
          <option value="">{t.common.all}</option>
          <option value="ONLINE">{t.enums.lessonMode.ONLINE}</option>
          <option value="IN_PERSON">{t.enums.lessonMode.IN_PERSON}</option>
        </select>
        <input name="city" defaultValue={city} placeholder={s.teachersFilterCity} className="input" aria-label={s.teachersFilterCity} />
        <Button type="submit">{t.common.filter}</Button>
      </form>
      {teachers.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title={s.teachersEmpty} />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((tp) => <TeacherCard key={tp.id} teacher={tp} href={`${base}/${tp.id}`} t={t} locale={locale} />)}
        </div>
      )}
    </>
  );
}
