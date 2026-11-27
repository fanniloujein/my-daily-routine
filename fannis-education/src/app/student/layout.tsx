import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { AppShell } from "@/components/AppShell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("STUDENT");
  const { t } = await getI18n();
  const n = t.nav.student;
  return (
    <AppShell
      user={user}
      rootHref="/student"
      items={[
        { href: "/student", label: n.dashboard, icon: "dashboard" },
        { href: "/student/subjects", label: n.subjects, icon: "book" },
        { href: "/student/library", label: n.library, icon: "library" },
        { href: "/student/progress", label: n.progress, icon: "progress" },
        { href: "/student/teachers", label: n.teachers, icon: "users" },
        { href: "/student/bookings", label: n.bookings, icon: "calendar" },
        { href: "/student/subscription", label: n.subscription, icon: "card" },
        { href: "/student/profile", label: n.profile, icon: "user" },
      ]}
    >
      {children}
    </AppShell>
  );
}
