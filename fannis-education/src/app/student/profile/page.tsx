import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { ChangePasswordForm, StudentProfileForm } from "@/components/client/ProfileForms";

export default async function ProfilePage() {
  const me = await requireUser("STUDENT");
  const { t, locale } = await getI18n();
  const [user, levels] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: me.id }, include: { studentProfile: true } }),
    prisma.educationalLevel.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
  ]);
  const p = user.studentProfile;
  return (
    <>
      <PageHeader title={t.student.profileTitle} subtitle={<span dir="ltr">{user.email}</span>} />
      <div className="space-y-6">
        <Card>
          <CardTitle>{t.student.profileInfo}</CardTitle>
          <StudentProfileForm
            levels={levels.map((l) => ({ id: l.id, label: localized(locale, l.name, l.nameAr) }))}
            defaults={{ name: user.name, phone: user.phone ?? "", levelId: p?.levelId ?? "", city: p?.city ?? "", school: p?.school ?? "", guardianPhone: p?.guardianPhone ?? "" }}
          />
        </Card>
        <Card>
          <CardTitle>{t.student.profilePassword}</CardTitle>
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}
