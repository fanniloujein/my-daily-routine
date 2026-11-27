import type { BookingStatus, Prisma } from "@prisma/client";
import { CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { getMyTeacherProfile } from "@/server/teacher";
import { Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { BookingItem } from "@/components/BookingItem";
import { TeacherBookingActions } from "@/components/TeacherBookingActions";

const FILTERS = ["PENDING", "ACCEPTED", "COMPLETED", "REJECTED", "CANCELLED"] as const;

export default async function TeacherBookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser("TEACHER");
  const { t, locale } = await getI18n();
  const profile = await getMyTeacherProfile(user.id);
  const { status } = await searchParams;
  const filter = FILTERS.includes(status as (typeof FILTERS)[number]) ? (status as BookingStatus) : undefined;
  const where: Prisma.BookingWhereInput = { teacherId: profile.id, ...(filter ? { status: filter } : {}) };
  const now = new Date();
  const [bookings, counts] = await Promise.all([
    prisma.booking.findMany({ where, orderBy: { startsAt: filter === "PENDING" || filter === "ACCEPTED" ? "asc" : "desc" }, take: 100, include: { subject: true, student: { select: { name: true, phone: true } } } }),
    prisma.booking.groupBy({ by: ["status"], where: { teacherId: profile.id }, _count: true }),
  ]);
  const count = (s: BookingStatus) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader title={t.teacher.bookingsTitle} />
      <Tabs
        items={[
          { href: "/teacher/bookings", label: t.teacher.filterAll, active: !filter },
          ...FILTERS.map((s) => ({ href: `/teacher/bookings?status=${s}`, label: t.enums.bookingStatus[s], active: filter === s, count: count(s) })),
        ]}
      />
      {bookings.length === 0 ? <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={t.teacher.bookingsEmpty} /> : (
        <Card>
          <ul className="divide-y divide-gray-50">
            {bookings.map((b) => (
              <BookingItem key={b.id} b={b} who={b.student.name + (b.status === "ACCEPTED" && b.student.phone ? ` · ${b.student.phone}` : "")} t={t} locale={locale} actions={<TeacherBookingActions b={b} t={t} now={now} />} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
