import type { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { confirmPaymentAction, refundPaymentAction, rejectPaymentAction } from "@/actions/admin";
import { Badge, Card, EmptyState, PageHeader, Table, Tabs, Td } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";

const STATUSES: PaymentStatus[] = ["PENDING", "CONFIRMED", "REJECTED", "REFUNDED"];
const TONE = { PENDING: "yellow", CONFIRMED: "green", REJECTED: "red", REFUNDED: "gray" } as const;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as PaymentStatus) ? (sp.status as PaymentStatus) : "PENDING";
  const [payments, counts] = await Promise.all([
    prisma.payment.findMany({
      where: { status },
      orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
      take: 100,
      include: { user: { select: { name: true, email: true } }, verifiedBy: { select: { name: true } }, subscription: { include: { plan: true } } },
    }),
    prisma.payment.groupBy({ by: ["status"], _count: true }),
  ]);
  return (
    <>
      <PageHeader title={a.paymentsTitle} subtitle={a.paymentsSubtitle} />
      <Tabs items={STATUSES.map((s) => ({ href: `/admin/payments?status=${s}`, label: t.enums.paymentStatus[s], active: s === status, count: counts.find((c) => c.status === s)?._count ?? 0 }))} />
      {payments.length === 0 ? <EmptyState title={a.paymentsEmpty} /> : (
        <Card>
          <Table head={[a.payer, a.purpose, a.amount, a.method, a.reference, t.common.date, t.common.actions]}>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td><p className="font-medium">{p.user.name}</p><p className="text-xs text-ink-muted" dir="ltr">{p.user.email}</p></Td>
                <Td>{t.enums.paymentPurpose[p.purpose]}{p.subscription && <span className="block text-xs text-ink-muted">{localized(locale, p.subscription.plan.name, p.subscription.plan.nameAr)}</span>}</Td>
                <Td className="font-semibold">{formatMoney(p.amountMillimes, locale)}</Td>
                <Td>{t.enums.paymentMethod[p.method]}</Td>
                <Td><span dir="ltr" className="font-mono text-xs">{p.reference ?? "—"}</span>{p.payerNote && <span className="block text-xs text-ink-muted">« {p.payerNote} »</span>}</Td>
                <Td className="text-xs text-ink-muted">
                  {formatDateTime(p.createdAt, locale)}
                  {p.verifiedAt && p.verifiedBy && <span className="block">{fmt(a.verifiedBy, { name: p.verifiedBy.name, date: formatDateTime(p.verifiedAt, locale) })}</span>}
                  {p.rejectionReason && <span className="block text-red-600">{p.rejectionReason}</span>}
                  {p.refundReason && <span className="block">{p.refundReason}</span>}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {p.status === "PENDING" && (
                      <>
                        <ActionButton variant="primary" confirmText={a.verifyConfirm} action={confirmPaymentAction.bind(null, p.id)}>{a.verify}</ActionButton>
                        <ActionButton variant="danger" input={{ label: a.rejectReasonLabel, required: true }} action={rejectPaymentAction.bind(null, p.id)}>{a.rejectPayment}</ActionButton>
                      </>
                    )}
                    {p.status === "CONFIRMED" && <ActionButton variant="danger" input={{ label: a.refundReason, required: true }} action={refundPaymentAction.bind(null, p.id)}>{a.refund}</ActionButton>}
                    {p.status !== "PENDING" && p.status !== "CONFIRMED" && <Badge tone={TONE[p.status]}>{t.enums.paymentStatus[p.status]}</Badge>}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
