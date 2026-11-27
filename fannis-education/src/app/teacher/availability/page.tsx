import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { minutesToHHMM } from "@/lib/time";
import { getMyTeacherProfile } from "@/server/teacher";
import { Card, PageHeader } from "@/components/ui";
import { AvailabilityEditor } from "@/components/client/TeacherForms";

export default async function AvailabilityPage() {
  const user = await requireUser("TEACHER");
  const { t } = await getI18n();
  const profile = await getMyTeacherProfile(user.id);
  return (
    <>
      <PageHeader title={t.teacher.availabilityTitle} subtitle={t.teacher.availabilitySubtitle} />
      <Card>
        <AvailabilityEditor
          defaults={profile.availabilities.map((a) => ({ dayOfWeek: a.dayOfWeek, start: minutesToHHMM(a.startMinute), end: minutesToHHMM(a.endMinute), mode: a.mode ?? "BOTH" }))}
        />
      </Card>
    </>
  );
}
