import { prisma } from "@/lib/prisma";
import { zonedParts } from "@/lib/time";

/** Indicateurs du tableau de bord administrateur. */
export async function getAdminStats(now = new Date()) {
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  const weeksAgo8 = new Date(now.getTime() - 8 * 7 * 86_400_000);
  const p = zonedParts(now);
  const sixMonthsStart = new Date(Date.UTC(p.year, p.month - 6, 1));

  const [students, activeSubs, pendingPayments, pendingTeachers, bookings30, revenue30, signups, payments6m, bookingsByStatus, topResources, activeSubRows, unhandledMessages] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.subscription.count({ where: { status: "ACTIVE", endsAt: { gt: now } } }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.teacherProfile.count({ where: { status: "PENDING" } }),
    prisma.booking.count({ where: { createdAt: { gte: d30 } } }),
    prisma.payment.aggregate({ where: { status: "CONFIRMED", verifiedAt: { gte: d30 } }, _sum: { amountMillimes: true } }),
    prisma.user.findMany({ where: { role: "STUDENT", createdAt: { gte: weeksAgo8 } }, select: { createdAt: true } }),
    prisma.payment.findMany({ where: { status: "CONFIRMED", verifiedAt: { gte: sixMonthsStart } }, select: { verifiedAt: true, amountMillimes: true } }),
    prisma.booking.groupBy({ by: ["status"], _count: true }),
    prisma.educationalResource.findMany({ where: { status: "PUBLISHED" }, orderBy: { downloadCount: "desc" }, take: 5, select: { id: true, title: true, downloadCount: true } }),
    prisma.subscription.findMany({ where: { status: "ACTIVE", endsAt: { gt: now } }, select: { priceMillimes: true, plan: { select: { durationDays: true } } } }),
    prisma.contactMessage.count({ where: { handledAt: null } }),
  ]);

  // MRR estimé : prix ramené à 30 jours pour chaque abonnement actif.
  const mrr = Math.round(activeSubRows.reduce((n, s) => n + (s.priceMillimes * 30) / s.plan.durationDays, 0));

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(weeksAgo8.getTime() + i * 7 * 86_400_000);
    const end = new Date(start.getTime() + 7 * 86_400_000);
    return { start, value: signups.filter((s) => s.createdAt >= start && s.createdAt < end).length };
  });
  const months = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(Date.UTC(p.year, p.month - 6 + i, 1));
    const end = new Date(Date.UTC(p.year, p.month - 5 + i, 1));
    return { start, value: payments6m.filter((x) => x.verifiedAt && x.verifiedAt >= start && x.verifiedAt < end).reduce((n, x) => n + x.amountMillimes, 0) };
  });

  return {
    students,
    activeSubs,
    conversion: students ? activeSubs / students : 0,
    pendingPayments,
    pendingTeachers,
    bookings30,
    revenue30: revenue30._sum.amountMillimes ?? 0,
    mrr,
    weeks,
    months,
    bookingsByStatus: Object.fromEntries(bookingsByStatus.map((b) => [b.status, b._count])) as Record<string, number>,
    topResources,
    unhandledMessages,
  };
}
