import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, MapPin, Monitor, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { addDaysIso, formatDate, toLocalIsoDate, addDays } from "@/lib/time";
import { MAX_BOOKING_DAYS_AHEAD } from "@/lib/domain/booking";
import type { CurrentUser } from "@/lib/auth/session";
import { PUBLIC_TEACHER_WHERE } from "@/server/catalog";
import { Alert, Avatar, Badge, Card, CardTitle, LinkButton, Stars } from "@/components/ui";
import { BookingForm } from "@/components/client/BookingForm";

export async function TeacherProfileView({ teacherId, viewer, backHref }: { teacherId: string; viewer: CurrentUser | null; backHref: string }) {
  const { t, locale } = await getI18n();
  const s = t.student;
  const teacher = await prisma.teacherProfile.findFirst({
    where: { id: teacherId, ...PUBLIC_TEACHER_WHERE },
    include: {
      user: { select: { name: true } },
      subjects: { include: { subject: true } },
      reviews: { where: { isVisible: true }, orderBy: { createdAt: "desc" }, take: 10, include: { student: { select: { name: true } } } },
    },
  });
  if (!teacher) notFound();

  const modes = [
    teacher.offersOnline && teacher.onlinePriceMillimes != null ? { value: "ONLINE" as const, label: t.enums.lessonMode.ONLINE, price: formatMoney(teacher.onlinePriceMillimes, locale) } : null,
    teacher.offersInPerson && teacher.inPersonPriceMillimes != null ? { value: "IN_PERSON" as const, label: t.enums.lessonMode.IN_PERSON, price: formatMoney(teacher.inPersonPriceMillimes, locale) } : null,
  ].filter((m) => m !== null);
  // Délai minimal de prévenance : on propose à partir de demain.
  const minDate = toLocalIsoDate(addDays(new Date(), 1));

  return (
    <>
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t.nav.teachers}</Link>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar name={teacher.user.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">{teacher.user.name}</h1>
                  {teacher.isDemo && <Badge tone="yellow">{t.common.demo}</Badge>}
                </div>
                {teacher.headline && <p className="mt-1 text-ink-soft">{teacher.headline}</p>}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
                  {teacher.ratingCount > 0 ? <Stars value={teacher.ratingAvg} count={teacher.ratingCount} /> : <span>{t.common.noRating}</span>}
                  {teacher.city && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden /> {teacher.city}</span>}
                  {teacher.yearsExperience > 0 && <span className="inline-flex items-center gap-1"><Briefcase className="h-4 w-4" aria-hidden /> {fmt(s.experience, { years: teacher.yearsExperience })}</span>}
                </div>
              </div>
            </div>
            {teacher.bio && (
              <div className="mt-6">
                <h2 className="mb-2 font-semibold">{s.about}</h2>
                <p className="whitespace-pre-line text-sm leading-6 text-ink-soft">{teacher.bio}</p>
              </div>
            )}
            <div className="mt-6">
              <h2 className="mb-2 font-semibold">{s.taughtSubjects}</h2>
              <div className="flex flex-wrap gap-1.5">
                {teacher.subjects.map((x) => <Badge key={x.subjectId} tone="blue">{localized(locale, x.subject.name, x.subject.nameAr)}</Badge>)}
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>{s.pricesTitle}</CardTitle>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {modes.map((m) => (
                <li key={m.value} className="flex items-center gap-3 rounded-xl bg-surface p-4">
                  {m.value === "ONLINE" ? <Monitor className="h-5 w-5 text-brand-500" aria-hidden /> : <Users className="h-5 w-5 text-brand-500" aria-hidden />}
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-lg font-bold">{m.price}</p>
                    {m.value === "IN_PERSON" && teacher.inPersonArea && <p className="text-xs text-ink-muted">{fmt(s.inPersonArea, { area: teacher.inPersonArea })}</p>}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">{fmt(s.sessionDuration, { minutes: teacher.lessonDurationMinutes })}</p>
          </Card>

          <Card>
            <CardTitle>{s.reviewsTitle}</CardTitle>
            {teacher.reviews.length === 0 ? <p className="text-sm text-ink-muted">{s.reviewsEmpty}</p> : (
              <ul className="divide-y divide-gray-50">
                {teacher.reviews.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Stars value={r.rating} />
                      <span className="text-xs text-ink-muted">{formatDate(r.createdAt, locale)}</span>
                    </div>
                    {r.comment && <p className="mt-1 text-sm text-ink-soft">{r.comment}</p>}
                    <p className="mt-1 text-xs text-ink-muted">{r.student.name.split(" ")[0]}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardTitle>{s.bookTitle}</CardTitle>
          {viewer?.role === "STUDENT" ? (
            modes.length === 0 ? <Alert tone="yellow">{t.errors.priceMissing}</Alert> : (
              <BookingForm
                teacherId={teacher.id}
                subjects={teacher.subjects.map((x) => ({ id: x.subjectId, label: localized(locale, x.subject.name, x.subject.nameAr) }))}
                modes={modes}
                minDate={minDate}
                maxDate={addDaysIso(toLocalIsoDate(new Date()), MAX_BOOKING_DAYS_AHEAD)}
              />
            )
          ) : (
            <div className="space-y-3 text-sm text-ink-soft">
              <p>{s.bookLogin}</p>
              {!viewer && (
                <div className="flex gap-2">
                  <LinkButton href={`/login?next=/student/teachers/${teacher.id}`}>{t.common.login}</LinkButton>
                  <LinkButton href="/register" variant="secondary">{t.common.register}</LinkButton>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
