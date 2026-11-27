import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TeacherProfileView } from "@/components/TeacherProfileView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (user?.role === "STUDENT") redirect(`/student/teachers/${id}`);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <TeacherProfileView teacherId={id} viewer={user} backHref="/teachers" />
    </div>
  );
}
