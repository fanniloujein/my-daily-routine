import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { AppShell } from "@/components/AppShell";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("TEACHER");
  const { t } = await getI18n();
  const n = t.nav.teacher;
  const pending = await prisma.booking.count({ where: { teacher: { userId: user.id }, status: "PENDING", startsAt: { gt: new Date() } } });
  return (
    <AppShell
      user={user}
      rootHref="/teacher"
      items={[
        { href: "/teacher", label: n.dashboard, icon: "dashboard" },
        { href: "/teacher/bookings", label: n.bookings, icon: "calendar", badge: pending },
        { href: "/teacher/availability", label: n.availability, icon: "clock" },
        { href: "/teacher/content", label: n.content, icon: "book" },
        { href: "/teacher/profile", label: n.profile, icon: "user" },
      ]}
    >
      {children}
    </AppShell>
  );
}
