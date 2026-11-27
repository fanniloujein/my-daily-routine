import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { AppShell } from "@/components/AppShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("ADMIN");
  const { t } = await getI18n();
  const n = t.nav.admin;
  const [payments, teachers, messages] = await Promise.all([
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.teacherProfile.count({ where: { status: "PENDING" } }),
    prisma.contactMessage.count({ where: { handledAt: null } }),
  ]);
  return (
    <AppShell
      user={user}
      rootHref="/admin"
      items={[
        { href: "/admin", label: n.dashboard, icon: "chart" },
        { href: "/admin/payments", label: n.payments, icon: "receipt", badge: payments },
        { href: "/admin/subscriptions", label: n.subscriptions, icon: "card" },
        { href: "/admin/plans", label: n.plans, icon: "wallet" },
        { href: "/admin/users", label: n.users, icon: "users" },
        { href: "/admin/teachers", label: n.teachers, icon: "cap", badge: teachers },
        { href: "/admin/catalog", label: n.catalog, icon: "layers" },
        { href: "/admin/courses", label: n.courses, icon: "book" },
        { href: "/admin/resources", label: n.resources, icon: "file" },
        { href: "/admin/quizzes", label: n.quizzes, icon: "quiz" },
        { href: "/admin/bookings", label: n.bookings, icon: "calendar" },
        { href: "/admin/messages", label: n.messages, icon: "mail", badge: messages },
        { href: "/admin/settings", label: n.settings, icon: "settings" },
      ]}
    >
      {children}
    </AppShell>
  );
}
