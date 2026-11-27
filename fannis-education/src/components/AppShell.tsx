import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/i18n/server";
import type { CurrentUser } from "@/lib/auth/session";
import { logoutAction } from "@/actions/auth";
import { Avatar } from "@/components/ui";
import { Logo } from "./Logo";
import { ShellNav, type NavItem } from "./client/ShellNav";
import { LocaleSwitcher } from "./client/LocaleSwitcher";

export async function AppShell({ user, items, rootHref, children }: { user: CurrentUser; items: NavItem[]; rootHref: string; children: React.ReactNode }) {
  const { t } = await getI18n();
  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });

  const footer = (
    <div className="space-y-1">
      <Link href={`${rootHref}/notifications`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface">
        <Bell className="h-[18px] w-[18px] text-ink-muted" aria-hidden />
        <span className="flex-1">{t.common.notifications}</span>
        {unread > 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">{unread}</span>}
      </Link>
      <LocaleSwitcher className="w-full justify-start px-3" />
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
        <Avatar name={user.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-ink-muted">{t.enums.role[user.role]}</p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="rounded-lg p-1.5 text-ink-muted hover:bg-surface hover:text-ink" aria-label={t.common.logout} title={t.common.logout}>
            <LogOut className="h-4 w-4 rtl:-scale-x-100" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      <ShellNav items={items} rootHref={rootHref} header={<Logo href={rootHref} />} footer={footer} />
      <main className="lg:ps-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
