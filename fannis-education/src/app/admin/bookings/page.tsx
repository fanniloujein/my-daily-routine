import type { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { adminCancelBookingAction, adminCompleteBookingAction } from "@/actions/admin";
import { Badge, Card, EmptyState, PageHeader, Table, Tabs, Td } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
import { BOOKING_TONE } from "@/components/BookingItem";
import { Pagination, qs } from "@/components/Pagination";

const STATUSES: BookingStatus[] = ["PENDING", "ACCEPTED", "COMPLETED", "REJECTED", "CANCELLED"];
const PER = 50;

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as BookingStatus) ? (sp.status as BookingStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = status ? { status } : {};
  const now = new Date();
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({ where, orderBy: { startsAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { subject: true, student: { select: { name: true } }, teacher: { include: { user: { select: { name: true } } } } } }),
    prisma.booking.count({ where }),
  ]);
  return (
    <>
      <PageHeader title={a.bookingsTitle} subtitle={a.bookingsSubtitle} />
      <Tabs items={[{ href: "/admin/bookings", label: t.common.all, active: !status }, ...STATUSES.map((s) => ({ href: `/admin/bookings?status=${s}`, label: t.enums.bookingStatus[s], active: s === status }))]} />
      {bookings.length === 0 ? <EmptyState title={a.bookingsEmpty} /> : (
        <Card>
          <Table head={[t.common.date, a.student, a.teacher, a.subject, t.common.price, t.common.status, t.common.actions]}>
            {bookings.map((b) => (
              <tr key={b.id}>
                <Td className="whitespace-nowrap">{formatDateTime(b.startsAt, locale)}<span className="block text-xs text-ink-muted">{t.enums.lessonMode[b.mode]}</span></Td>
                <Td>{b.student.name}</Td>
                <Td>{b.teacher.user.name}</Td>
                <Td>{localized(locale, b.subject.name, b.subject.nameAr)}</Td>
                <Td>{formatMoney(b.priceMillimes, locale)}</Td>
                <Td><Badge tone={BOOKING_TONE[b.status]}>{t.enums.bookingStatus[b.status]}</Badge></Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {b.status === "ACCEPTED" && b.endsAt <= now && <ActionButton action={adminCompleteBookingAction.bind(null, b.id)}>{t.teacher.complete}</ActionButton>}
                    {(b.status === "PENDING" || b.status === "ACCEPTED") && <ActionButton variant="danger" input={{ label: t.teacher.cancelReason, required: true }} action={adminCancelBookingAction.bind(null, b.id)}>{t.common.cancel}</ActionButton>}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      <Pagination t={t} page={page} pages={Math.ceil(total / PER)} hrefFor={(p) => qs("/admin/bookings", { status, page: p })} />
    </>
  );
}
