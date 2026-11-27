import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { subjectOptions } from "@/server/admin-options";
import { CourseEditor } from "@/components/CourseEditor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("ADMIN");
  const { locale } = await getI18n();
  return <CourseEditor user={user} courseId={(await params).id} backHref="/admin/courses" subjectOptions={await subjectOptions(locale)} />;
}
