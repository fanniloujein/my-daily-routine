import { requireUser } from "@/lib/auth/session";
import { TeacherProfileView } from "@/components/TeacherProfileView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("STUDENT");
  return <TeacherProfileView teacherId={(await params).id} viewer={user} backHref="/student/teachers" />;
}
