import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { getMyTeacherProfile } from "@/server/teacher";
import { CourseEditor } from "@/components/CourseEditor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("TEACHER");
  const { locale } = await getI18n();
  const profile = await getMyTeacherProfile(user.id);
  return (
    <CourseEditor
      user={user}
      courseId={(await params).id}
      backHref="/teacher/content"
      subjectOptions={profile.subjects.map((s) => ({ id: s.subjectId, label: localized(locale, s.subject.name, s.subject.nameAr) }))}
    />
  );
}
