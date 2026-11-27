import { TeacherDirectory } from "@/components/TeacherDirectory";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ subject?: string; mode?: string; city?: string }> }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <TeacherDirectory base="/teachers" searchParams={await searchParams} />
    </div>
  );
}
