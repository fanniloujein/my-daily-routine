import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { millimesToTndString } from "@/lib/money";
import { getActiveLevelsWithSubjects } from "@/server/catalog";
import { getMyTeacherProfile } from "@/server/teacher";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { TeacherProfileForm } from "@/components/client/TeacherForms";
import { ChangePasswordForm } from "@/components/client/ProfileForms";

export default async function TeacherProfilePage() {
  const user = await requireUser("TEACHER");
  const { t, locale } = await getI18n();
  const [p, levels] = await Promise.all([getMyTeacherProfile(user.id), getActiveLevelsWithSubjects()]);
  const tone = p.status === "APPROVED" ? "green" : p.status === "PENDING" ? "yellow" : "red";
  return (
    <>
      <PageHeader title={t.teacher.profileTitle} subtitle={t.teacher.profileSubtitle} actions={<Badge tone={tone}>{t.enums.teacherStatus[p.status]}</Badge>} />
      <Card className="mb-6">
        <TeacherProfileForm
          subjectGroups={levels.map((l) => ({ level: localized(locale, l.name, l.nameAr), subjects: l.subjects.map((s) => ({ id: s.id, label: localized(locale, s.name, s.nameAr) })) }))}
          defaults={{
            headline: p.headline ?? "",
            bio: p.bio ?? "",
            city: p.city ?? "",
            yearsExperience: p.yearsExperience,
            subjectIds: p.subjects.map((s) => s.subjectId),
            offersOnline: p.offersOnline,
            offersInPerson: p.offersInPerson,
            onlinePrice: p.onlinePriceMillimes != null ? millimesToTndString(p.onlinePriceMillimes) : "",
            inPersonPrice: p.inPersonPriceMillimes != null ? millimesToTndString(p.inPersonPriceMillimes) : "",
            inPersonArea: p.inPersonArea ?? "",
            lessonDurationMinutes: p.lessonDurationMinutes,
          }}
        />
      </Card>
      <Card>
        <CardTitle>{t.student.profilePassword}</CardTitle>
        <ChangePasswordForm />
      </Card>
    </>
  );
}
