import { CreditCard } from "lucide-react";
import type { getStudentAccess } from "@/server/subscriptions";
import { fmt, type AppLocale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dict";
import { formatDate } from "@/lib/time";
import { Badge, Card, LinkButton } from "@/components/ui";

export function SubscriptionCard({ access, t, locale, compact }: { access: Awaited<ReturnType<typeof getStudentAccess>>; t: Dict; locale: AppLocale; compact?: boolean }) {
  const s = t.student;
  const { state, endsAt, daysLeft } = access.renewal;
  const date = endsAt ? formatDate(endsAt, locale, { dateStyle: "long" }) : "";
  const text =
    state === "ACTIVE" ? fmt(s.subActive, { date })
    : state === "EXPIRING_SOON" ? fmt(s.subExpiring, { days: daysLeft ?? 0, date })
    : state === "PENDING" ? (endsAt ? `${fmt(s.subActive, { date })} ${s.subPending}` : s.subPending)
    : state === "EXPIRED" ? s.subExpired
    : s.subNone;
  const tone = state === "ACTIVE" ? "green" : state === "EXPIRING_SOON" || state === "PENDING" ? "yellow" : state === "EXPIRED" ? "red" : "gray";
  const label = state === "ACTIVE" || state === "EXPIRING_SOON" ? t.enums.subscriptionStatus.ACTIVE : state === "PENDING" ? t.enums.subscriptionStatus.PENDING_PAYMENT : state === "EXPIRED" ? t.enums.subscriptionStatus.EXPIRED : t.common.none;
  return (
    <Card className={state === "ACTIVE" ? "" : "border-sun-200 bg-gradient-to-br from-white to-sun-50"}>
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><CreditCard className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{s.subCardTitle}</h2>
            <Badge tone={tone}>{label}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-soft">{text}</p>
          {!compact && (
            <LinkButton href="/student/subscription" size="sm" variant={state === "ACTIVE" || state === "PENDING" ? "secondary" : "primary"} className="mt-4">
              {state === "EXPIRED" || state === "EXPIRING_SOON" ? s.subRenew : state === "NONE" ? t.common.subscribeCta : s.subManage}
            </LinkButton>
          )}
        </div>
      </div>
    </Card>
  );
}
