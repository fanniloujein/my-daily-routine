import type { TeacherStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { setTeacherStatusAction } from "@/actions/admin";
import { Avatar, Badge, Card, EmptyState, PageHeader, Stars, Tabs } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";

const STATUSES: TeacherStatus[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
const TONE = { PENDING: "yellow", APPROVED: "green", REJECTED: "red", SUSPENDED: "gray" } as const;

export default async function AdminTeachersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as TeacherStatus) ? (sp.status as TeacherStatus) : "PENDING";
  const [teachers, counts] = await Promise.all([
    prisma.teacherProfile.findMany({
      where: { status },
      orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
      include: { user: { select: { name: true, email: true, phone: true } }, subjects: { include: { subject: true } }, _count: { select: { bookings: true, availabilities: true } } },
    }),
    prisma.teacherProfile.groupBy({ by: ["status"], _count: true }),
  ]);
  return (
    <>
      <PageHeader title={a.teachersTitle} subtitle={a.teachersSubtitle} />
      <Tabs items={STATUSES.map((s) => ({ href: `/admin/teachers?status=${s}`, label: t.enums.teacherStatus[s], active: s === status, count: counts.find((c) => c.status === s)?._count ?? 0 }))} />
      {teachers.length === 0 ? <EmptyState title={a.teachersEmpty} /> : (
        <div className="space-y-4">
          {teachers.map((tp) => (
            <Card key={tp.id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start">
                <Avatar name={tp.user.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{tp.user.name}</h2>
                    <Badge tone={TONE[tp.status]}>{t.enums.teacherStatus[tp.status]}</Badge>
                    {tp.isDemo && <Badge tone="yellow">{t.common.demo}</Badge>}
                  </div>
                  <p className="text-sm text-ink-muted" dir="ltr">{tp.user.email}{tp.user.phone ? ` · ${tp.user.phone}` : ""}</p>
                  {tp.headline && <p className="mt-2 text-sm">{tp.headline}</p>}
                  {tp.bio && <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{tp.bio}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">{tp.subjects.map((s) => <Badge key={s.subjectId} tone="blue">{localized(locale, s.subject.name, s.subject.nameAr)}</Badge>)}</div>
                  <p className="mt-3 text-xs text-ink-muted">
                    {tp.city ?? "—"} · {fmt(t.student.experience, { years: tp.yearsExperience })} ·{" "}
                    {tp.offersOnline && tp.onlinePriceMillimes != null ? `${t.enums.lessonMode.ONLINE} ${formatMoney(tp.onlinePriceMillimes, locale)} · ` : ""}
                    {tp.offersInPerson && tp.inPersonPriceMillimes != null ? `${t.enums.lessonMode.IN_PERSON} ${formatMoney(tp.inPersonPriceMillimes, locale)} · ` : ""}
                    {tp._count.availabilities} {t.nav.teacher.availability.toLowerCase()} · {tp._count.bookings} {t.nav.teacher.bookings.toLowerCase()} · {t.common.createdAt} {formatDate(tp.createdAt, locale)}
                  </p>
                  {tp.ratingCount > 0 && <div className="mt-1"><Stars value={tp.ratingAvg} count={tp.ratingCount} /></div>}
                  {tp.rejectionReason && <p className="mt-2 text-sm text-red-600">{t.common.reason} : {tp.rejectionReason}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {tp.status !== "APPROVED" && <ActionButton variant="primary" confirmText={t.common.confirmAction} action={setTeacherStatusAction.bind(null, tp.id, "APPROVED")}>{a.approve}</ActionButton>}
                  {tp.status === "PENDING" && <ActionButton variant="danger" input={{ label: a.rejectReasonLabel, required: true }} action={setTeacherStatusAction.bind(null, tp.id, "REJECTED")}>{a.rejectTeacher}</ActionButton>}
                  {tp.status === "APPROVED" && <ActionButton variant="danger" confirmText={t.common.confirmAction} action={setTeacherStatusAction.bind(null, tp.id, "SUSPENDED")}>{a.suspendTeacher}</ActionButton>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
