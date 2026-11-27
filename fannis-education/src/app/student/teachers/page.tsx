import { TeacherDirectory } from "@/components/TeacherDirectory";

export default async function Page({ searchParams }: { searchParams: Promise<{ subject?: string; mode?: string; city?: string }> }) {
  return <TeacherDirectory base="/student/teachers" searchParams={await searchParams} />;
}
