import { CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { cancelBookingAction } from "@/actions/student";
import { Card, CardTitle, EmptyState, LinkButton, PageHeader, Stars } from "@/components/ui";
import { BookingItem } from "@/components/BookingItem";
import { ActionButton } from "@/components/client/ActionButton";
import { ReviewForm } from "@/components/client/ReviewForm";

export default async function StudentBookingsPage() {
  const user = await requireUser("STUDENT");
  const { t, locale } = await getI18n();
  const s = t.student;
  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: { studentId: user.id },
    orderBy: { startsAt: "desc" },
    take: 100,
    include: { subject: true, review: true, teacher: { include: { user: { select: { name: true } } } } },
  });
  const upcoming = bookings.filter((b) => ["PENDING", "ACCEPTED"].includes(b.status) && b.endsAt > now).reverse();
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <>
      <PageHeader title={s.bookingsTitle} actions={<LinkButton href="/student/teachers">{s.findTeacher}</LinkButton>} />
      {bookings.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={s.bookingsEmpty} action={<LinkButton href="/student/teachers" variant="secondary">{s.findTeacher}</LinkButton>} />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardTitle>{s.bookingsUpcoming}</CardTitle>
            {upcoming.length === 0 ? <p className="text-sm text-ink-muted">{s.upcomingEmpty}</p> : (
              <ul className="divide-y divide-gray-50">
                {upcoming.map((b) => (
                  <BookingItem
                    key={b.id}
                    b={b}
                    who={fmt(s.bookingWith, { teacher: b.teacher.user.name })}
                    t={t}
                    locale={locale}
                    actions={<ActionButton variant="danger" action={cancelBookingAction.bind(null, b.id)} confirmText={s.bookingCancelConfirm} input={{ label: `${t.common.reason} (${t.common.optional})` }}>{s.bookingCancel}</ActionButton>}
                  />
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle>{s.bookingsPast}</CardTitle>
            {past.length === 0 ? <p className="text-sm text-ink-muted">{s.bookingsEmpty}</p> : (
              <ul className="divide-y divide-gray-50">
                {past.map((b) => (
                  <BookingItem key={b.id} b={b} who={fmt(s.bookingWith, { teacher: b.teacher.user.name })} t={t} locale={locale}>
                    {b.status === "COMPLETED" && (b.review ? (
                      <p className="mt-2 text-sm"><Stars value={b.review.rating} label={fmt(s.yourReview, { rating: b.review.rating })} /></p>
                    ) : (
                      <div className="mt-2"><ReviewForm bookingId={b.id} /></div>
                    ))}
                  </BookingItem>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
