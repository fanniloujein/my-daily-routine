import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/time";
import { markMessageHandledAction } from "@/actions/admin";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";

export default async function MessagesPage() {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const messages = await prisma.contactMessage.findMany({ orderBy: [{ handledAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }], take: 200 });
  return (
    <>
      <PageHeader title={a.messagesTitle} />
      {messages.length === 0 ? <EmptyState title={a.messagesEmpty} /> : (
        <div className="space-y-3">
          {messages.map((m) => (
            <Card key={m.id} className={m.handledAt ? "opacity-70" : ""}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{m.name} <a href={`mailto:${m.email}`} className="text-sm font-normal text-brand-700" dir="ltr">{m.email}</a></p>
                  <p className="text-xs text-ink-muted">{formatDateTime(m.createdAt, locale)}</p>
                </div>
                {m.handledAt ? <Badge tone="green">{a.handled}</Badge> : <ActionButton action={markMessageHandledAction.bind(null, m.id)}>{a.markHandled}</ActionButton>}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{m.message}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
