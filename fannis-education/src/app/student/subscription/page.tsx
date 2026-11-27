import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { effectiveStatus } from "@/lib/domain/subscription";
import { getStudentAccess } from "@/server/subscriptions";
import { getActivePlans } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { cancelSubscriptionRequestAction } from "@/actions/student";
import { PAYMENT_METHODS_MANUAL } from "@/lib/validation/student";
import { Alert, Badge, Card, CardTitle, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { SubscribeForm } from "@/components/client/SubscribeForm";
import { ActionButton } from "@/components/client/ActionButton";

const STATUS_TONE = { ACTIVE: "green", PENDING_PAYMENT: "yellow", EXPIRED: "gray", CANCELLED: "red" } as const;

export default async function SubscriptionPage() {
  const user = await requireUser("STUDENT");
  const { t, locale } = await getI18n();
  const s = t.student;
  const now = new Date();
  const [access, plans, settings, history] = await Promise.all([
    getStudentAccess(user.id, now),
    getActivePlans(),
    getSettings(),
    prisma.subscription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { plan: true, payments: { orderBy: { createdAt: "desc" } } }, take: 30 }),
  ]);
  const methods = settings.enabledPaymentMethods.filter((m): m is (typeof PAYMENT_METHODS_MANUAL)[number] => (PAYMENT_METHODS_MANUAL as readonly string[]).includes(m));
  const pending = access.pending;

  return (
    <>
      <PageHeader title={s.subTitle} subtitle={s.subSubtitle} />
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SubscriptionCard access={access} t={t} locale={locale} compact />
        <Alert tone="gray">{s.subTutoringNote}</Alert>
      </div>

      {pending ? (
        <Alert
          tone="yellow"
          className="mb-6"
          title={s.subPending}
          action={<ActionButton action={cancelSubscriptionRequestAction.bind(null, pending.id)} variant="danger" confirmText={s.subCancelRequest}>{s.subCancelRequest}</ActionButton>}
        >
          {fmt(s.subPendingNotice, { plan: localized(locale, pending.plan.name, pending.plan.nameAr), amount: formatMoney(pending.priceMillimes, locale), date: formatDate(pending.createdAt, locale) })}
        </Alert>
      ) : plans.length === 0 ? (
        <EmptyState title={s.subNoPlans} />
      ) : (
        <>
          {access.hasPremium && <Alert tone="blue" className="mb-4">{s.subRenewEarly}</Alert>}
          <SubscribeForm
            plans={plans.map((p) => ({
              id: p.id,
              name: localized(locale, p.name, p.nameAr),
              description: p.description ? localized(locale, p.description, p.descriptionAr) : null,
              price: formatMoney(p.priceMillimes, locale),
              days: p.durationDays,
              featured: p.isFeatured,
              features: (locale === "ar" && Array.isArray(p.featuresAr) && p.featuresAr.length ? p.featuresAr : p.features) as string[],
            }))}
            methods={methods}
            instructions={locale === "ar" ? settings.paymentInstructionsAr : settings.paymentInstructions}
          />
        </>
      )}

      <Card className="mt-8">
        <CardTitle>{s.subHistory}</CardTitle>
        {history.length === 0 ? <p className="text-sm text-ink-muted">{s.subHistoryEmpty}</p> : (
          <Table head={[t.admin.plan, t.admin.period, t.common.price, t.admin.method, t.common.status]}>
            {history.map((h) => {
              const st = effectiveStatus(h, now);
              const pay = h.payments[0];
              return (
                <tr key={h.id}>
                  <Td className="font-medium">{localized(locale, h.plan.name, h.plan.nameAr)}</Td>
                  <Td className="text-ink-muted">{h.startsAt && h.endsAt ? fmt(s.subPeriod, { start: formatDate(h.startsAt, locale), end: formatDate(h.endsAt, locale) }) : formatDate(h.createdAt, locale)}</Td>
                  <Td>{formatMoney(h.priceMillimes, locale)}</Td>
                  <Td className="text-ink-muted">{pay ? `${t.enums.paymentMethod[pay.method]} · ${t.enums.paymentStatus[pay.status]}` : "—"}{pay?.rejectionReason && <span className="block text-xs text-red-600">{pay.rejectionReason}</span>}</Td>
                  <Td><Badge tone={STATUS_TONE[st]}>{t.enums.subscriptionStatus[st]}</Badge></Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
