import { CalendarCheck, CheckCircle2, Clock, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { getMyTeacherProfile, isBookable } from "@/server/teacher";
import { Alert, Card, CardTitle, LinkButton, PageHeader, StatCard, Stars } from "@/components/ui";
import { BookingItem } from "@/components/BookingItem";
import { TeacherBookingActions } from "@/components/TeacherBookingActions";

export default async function TeacherDashboard() {
  const user = await requireUser("TEACHER");
  const { t, locale } = await getI18n();
  const tt = t.teacher;
  const profile = await getMyTeacherProfile(user.id);
  const now = new Date();
  const include = { subject: true, student: { select: { name: true } } } as const;
  const [pending, upcoming, completedAgg, reviews] = await Promise.all([
    prisma.booking.findMany({ where: { teacherId: profile.id, status: "PENDING", startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, include, take: 5 }),
    prisma.booking.findMany({ where: { teacherId: profile.id, status: "ACCEPTED", endsAt: { gt: now } }, orderBy: { startsAt: "asc" }, include, take: 5 }),
    prisma.booking.aggregate({ where: { teacherId: profile.id, status: "COMPLETED" }, _count: true, _sum: { priceMillimes: true } }),
    prisma.review.findMany({ where: { teacherId: profile.id, isVisible: true }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <>
      <PageHeader title={fmt(tt.hello, { name: user.name.split(" ")[0] })} />
      {profile.status === "PENDING" && <Alert tone="yellow" className="mb-4">{tt.pendingBanner}</Alert>}
      {profile.status === "REJECTED" && <Alert tone="red" className="mb-4">{fmt(tt.rejectedBanner, { reason: profile.rejectionReason ?? t.notify.noReason })}</Alert>}
      {profile.status === "SUSPENDED" && <Alert tone="red" className="mb-4">{tt.suspendedBanner}</Alert>}
      {!isBookable(profile) && (
        <Alert tone="blue" className="mb-4" action={<LinkButton href="/teacher/profile" size="sm">{t.common.edit}</LinkButton>}>{tt.incompleteBanner}</Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={tt.statPending} value={pending.length} icon={<Clock className="h-5 w-5" />} tone="yellow" />
        <StatCard label={tt.statUpcoming} value={upcoming.length} icon={<CalendarCheck className="h-5 w-5" />} />
        <StatCard label={tt.statCompleted} value={completedAgg._count} icon={<CheckCircle2 className="h-5 w-5" />} hint={`${tt.statRevenue} : ${formatMoney(completedAgg._sum.priceMillimes ?? 0, locale)}`} />
        <StatCard label={tt.statRating} value={profile.ratingCount ? profile.ratingAvg.toFixed(1) : "—"} icon={<Star className="h-5 w-5" />} tone="gray" hint={fmt(t.common.reviews, { count: profile.ratingCount })} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{tt.pendingRequests}</CardTitle>
          {pending.length === 0 ? <p className="text-sm text-ink-muted">{tt.pendingRequestsEmpty}</p> : (
            <ul className="divide-y divide-gray-50">
              {pending.map((b) => <BookingItem key={b.id} b={b} who={b.student.name} t={t} locale={locale} actions={<TeacherBookingActions b={b} t={t} now={now} />} />)}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>{tt.nextSessions}</CardTitle>
          {upcoming.length === 0 ? <p className="text-sm text-ink-muted">{tt.nextSessionsEmpty}</p> : (
            <ul className="divide-y divide-gray-50">
              {upcoming.map((b) => <BookingItem key={b.id} b={b} who={b.student.name} t={t} locale={locale} />)}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle>{tt.feedbackTitle}</CardTitle>
          {reviews.length === 0 ? <p className="text-sm text-ink-muted">{tt.feedbackEmpty}</p> : (
            <ul className="divide-y divide-gray-50">
              {reviews.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-ink-muted">{formatDate(r.createdAt, locale)}</span></div>
                  {r.comment && <p className="mt-1 text-sm text-ink-soft">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
