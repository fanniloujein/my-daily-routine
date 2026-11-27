import Link from "next/link";
import { CalendarDays, CreditCard, GraduationCap, Mail, Receipt, TrendingUp, Users, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { getAdminStats } from "@/server/stats";
import { Card, CardTitle, PageHeader, StatCard } from "@/components/ui";
import { BarChart } from "@/components/BarChart";
import { BOOKING_TONE } from "@/components/BookingItem";
import { Badge } from "@/components/ui";

export default async function AdminOverview() {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const s = await getAdminStats();
  const todo = [
    { href: "/admin/payments", label: a.kpiPendingPayments, value: s.pendingPayments, icon: Receipt },
    { href: "/admin/teachers?status=PENDING", label: a.kpiPendingTeachers, value: s.pendingTeachers, icon: GraduationCap },
    { href: "/admin/messages", label: t.nav.admin.messages, value: s.unhandledMessages, icon: Mail },
  ];
  return (
    <>
      <PageHeader title={a.overviewTitle} subtitle={a.overviewSubtitle} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={a.kpiStudents} value={s.students} icon={<Users className="h-5 w-5" />} />
        <StatCard label={a.kpiActiveSubs} value={s.activeSubs} icon={<CreditCard className="h-5 w-5" />} hint={`${a.kpiConversion} : ${Math.round(s.conversion * 100)} %`} />
        <StatCard label={a.kpiMrr} value={formatMoney(s.mrr, locale)} icon={<TrendingUp className="h-5 w-5" />} tone="yellow" />
        <StatCard label={a.kpiRevenue30} value={formatMoney(s.revenue30, locale)} icon={<Wallet className="h-5 w-5" />} tone="gray" hint={`${a.kpiBookings30} : ${s.bookings30}`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardTitle>{a.todo}</CardTitle>
          <ul className="space-y-2">
            {todo.map((x) => (
              <li key={x.href}>
                <Link href={x.href} className="flex items-center gap-3 rounded-xl p-3 hover:bg-surface">
                  <x.icon className="h-5 w-5 text-brand-500" aria-hidden />
                  <span className="flex-1 text-sm">{x.label}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${x.value ? "bg-sun-200 text-ink" : "bg-surface text-ink-muted"}`}>{x.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>{a.signupsChart}</CardTitle>
          <BarChart label={a.signupsChart} data={s.weeks.map((w) => ({ label: formatDate(w.start, locale, { day: "numeric", month: "numeric" }), value: w.value }))} />
        </Card>
        <Card>
          <CardTitle>{a.revenueChart}</CardTitle>
          <BarChart label={a.revenueChart} format={(v) => String(Math.round(v / 1000))} data={s.months.map((m) => ({ label: formatDate(m.start, locale, { month: "short" }), value: m.value }))} />
        </Card>
        <Card>
          <CardTitle>{a.bookingsByStatus}</CardTitle>
          <ul className="space-y-2 text-sm">
            {(["PENDING", "ACCEPTED", "COMPLETED", "REJECTED", "CANCELLED"] as const).map((st) => (
              <li key={st} className="flex items-center justify-between"><Badge tone={BOOKING_TONE[st]}>{t.enums.bookingStatus[st]}</Badge><span className="font-semibold">{s.bookingsByStatus[st] ?? 0}</span></li>
            ))}
          </ul>
          <Link href="/admin/bookings" className="mt-4 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><CalendarDays className="h-4 w-4" /> {t.common.seeAll}</Link>
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle>{a.topContent}</CardTitle>
          {s.topResources.length === 0 ? <p className="text-sm text-ink-muted">{a.resourcesEmpty}</p> : (
            <ol className="space-y-2 text-sm">
              {s.topResources.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3"><span className="w-5 text-ink-muted">{i + 1}.</span><span className="flex-1 truncate">{r.title}</span><span className="font-semibold">{r.downloadCount}</span></li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
