import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { getCurrentUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/token";
import { Card } from "@/components/ui";
import { StudentRegisterForm } from "@/components/client/RegisterForms";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.common.register };
}

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeForRole(user.role));
  const { t, locale } = await getI18n();
  const levels = await prisma.educationalLevel.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold">{t.auth.registerTitle}</h1>
      <p className="mb-6 mt-1 text-ink-muted">{t.auth.registerSubtitle}</p>
      <StudentRegisterForm levels={levels.map((l) => ({ id: l.id, label: localized(locale, l.name, l.nameAr) }))} />
      <p className="mt-6 text-center text-sm text-ink-muted">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">{t.common.login}</Link>
      </p>
      <p className="mt-2 text-center text-sm text-ink-muted">
        {t.auth.areYouTeacher}{" "}
        <Link href="/register/teacher" className="font-medium text-brand-700 hover:underline">{t.auth.teacherCta}</Link>
      </p>
    </Card>
  );
}
