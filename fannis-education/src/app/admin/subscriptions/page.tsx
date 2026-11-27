import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { effectiveStatus, type SubscriptionStatus } from "@/lib/domain/subscription";
import { cancelSubscriptionAction, extendSubscriptionAction, runExpiryAction } from "@/actions/admin";
import { Badge, Card, EmptyState, PageHeader, Table, Tabs, Td } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
import { Pagination, qs } from "@/components/Pagination";

const STATUSES: SubscriptionStatus[] = ["ACTIVE", "PENDING_PAYMENT", "EXPIRED", "CANCELLED"];
const TONE = { ACTIVE: "green", PENDING_PAYMENT: "yellow", EXPIRED: "gray", CANCELLED: "red" } as const;
const PER = 50;

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as SubscriptionStatus) ? (sp.status as SubscriptionStatus) : "ACTIVE";
  const page = Math.max(1, Number(sp.page) || 1);
  const now = new Date();
  // « Actif » = statut ACTIVE ET date de fin future ; les ACTIVE échus apparaissent dans « Expiré ».
  const where: Prisma.SubscriptionWhereInput =
    status === "ACTIVE" ? { status: "ACTIVE", endsAt: { gt: now } }
    : status === "EXPIRED" ? { OR: [{ status: "EXPIRED" }, { status: "ACTIVE", endsAt: { lte: now } }] }
    : { status };
  const [subs, total] = await Promise.all([
    prisma.subscription.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { user: { select: { name: true, email: true } }, plan: true } }),
    prisma.subscription.count({ where }),
  ]);
  return (
    <>
      <PageHeader title={a.subscriptionsTitle} subtitle={a.subscriptionsSubtitle} actions={<ActionButton action={runExpiryAction}>{a.runExpiry}</ActionButton>} />
      <Tabs items={STATUSES.map((s) => ({ href: `/admin/subscriptions?status=${s}`, label: t.enums.subscriptionStatus[s], active: s === status }))} />
      {subs.length === 0 ? <EmptyState title={a.subscriptionsEmpty} /> : (
        <Card>
          <Table head={[a.student, a.plan, a.period, t.common.price, t.common.status, t.common.actions]}>
            {subs.map((s) => {
              const st = effectiveStatus(s, now);
              return (
                <tr key={s.id}>
                  <Td><p className="font-medium">{s.user.name}</p><p className="text-xs text-ink-muted" dir="ltr">{s.user.email}</p></Td>
                  <Td>{localized(locale, s.plan.name, s.plan.nameAr)}</Td>
                  <Td className="text-ink-muted">{s.startsAt && s.endsAt ? `${formatDate(s.startsAt, locale)} → ${formatDate(s.endsAt, locale)}` : "—"}</Td>
                  <Td>{formatMoney(s.priceMillimes, locale)}</Td>
                  <Td><Badge tone={TONE[st]}>{t.enums.subscriptionStatus[st]}</Badge></Td>
                  <Td>
                    {st === "ACTIVE" && (
                      <div className="flex flex-wrap gap-2">
                        <ActionButton input={{ label: a.extendDays, type: "number", required: true, defaultValue: "7" }} action={extendSubscriptionAction.bind(null, s.id)}>{a.extend}</ActionButton>
                        <ActionButton variant="danger" confirmText={t.common.confirmAction} action={cancelSubscriptionAction.bind(null, s.id)}>{a.cancelSub}</ActionButton>
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}
      <Pagination t={t} page={page} pages={Math.ceil(total / PER)} hrefFor={(p) => qs("/admin/subscriptions", { status, page: p })} />
    </>
  );
}
