import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/time";
import type { CurrentUser } from "@/lib/auth/session";
import { markNotificationsReadAction } from "@/actions/notifications";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
import { cn } from "@/components/ui/cn";

export async function NotificationsPage({ user }: { user: CurrentUser }) {
  const { t, locale } = await getI18n();
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.some((n) => !n.readAt);
  return (
    <>
      <PageHeader
        title={t.common.notifications}
        actions={unread ? <ActionButton action={markNotificationsReadAction.bind(null, undefined)}>{t.common.markAllRead}</ActionButton> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="h-5 w-5" />} title={t.common.noNotifications} />
      ) : (
        <Card className="divide-y divide-gray-50 p-0 sm:p-0">
          {items.map((n) => (
            <div key={n.id} className={cn("flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5", !n.readAt && "bg-brand-50/50")}>
              <span className={cn("mt-1.5 hidden h-2 w-2 shrink-0 rounded-full sm:block", n.readAt ? "bg-transparent" : "bg-brand-500")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{n.link ? <Link href={n.link} className="hover:text-brand-700">{n.title}</Link> : n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-ink-soft">{n.body}</p>}
                <p className="mt-1 text-xs text-ink-muted">{formatDateTime(n.createdAt, locale)}</p>
              </div>
              {!n.readAt && <ActionButton variant="ghost" action={markNotificationsReadAction.bind(null, n.id)}>{t.common.markRead}</ActionButton>}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
