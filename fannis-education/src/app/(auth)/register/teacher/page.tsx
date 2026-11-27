import Link from "next/link";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { getCurrentUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/token";
import { getActiveLevelsWithSubjects } from "@/server/catalog";
import { Card } from "@/components/ui";
import { TeacherRegisterForm } from "@/components/client/RegisterForms";

export default async function TeacherRegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeForRole(user.role));
  const { t, locale } = await getI18n();
  const levels = await getActiveLevelsWithSubjects();
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold">{t.auth.teacherRegisterTitle}</h1>
      <p className="mb-6 mt-1 text-ink-muted">{t.auth.teacherRegisterSubtitle}</p>
      <TeacherRegisterForm
        subjectGroups={levels.map((l) => ({
          level: localized(locale, l.name, l.nameAr),
          subjects: l.subjects.map((s) => ({ id: s.id, label: localized(locale, s.name, s.nameAr) })),
        }))}
      />
      <p className="mt-6 text-center text-sm text-ink-muted">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">{t.common.login}</Link>
      </p>
    </Card>
  );
}
