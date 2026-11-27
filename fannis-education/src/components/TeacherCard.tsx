import Link from "next/link";
import { MapPin, Monitor, Users } from "lucide-react";
import type { PublicTeacher } from "@/server/catalog";
import { Avatar, Badge, Stars } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { fmt, localized, type AppLocale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dict";

export function TeacherCard({ teacher, href, t, locale }: { teacher: PublicTeacher; href: string; t: Dict; locale: AppLocale }) {
  const prices = [teacher.offersOnline ? teacher.onlinePriceMillimes : null, teacher.offersInPerson ? teacher.inPersonPriceMillimes : null].filter(
    (p): p is number => p != null,
  );
  const from = prices.length ? Math.min(...prices) : null;
  return (
    <Link href={href} className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-card transition hover:border-brand-200">
      <div className="flex items-start gap-3">
        <Avatar name={teacher.user.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold group-hover:text-brand-700">{teacher.user.name}</p>
          {teacher.headline && <p className="line-clamp-2 text-sm text-ink-muted">{teacher.headline}</p>}
        </div>
        {teacher.isDemo && <Badge tone="yellow">{t.common.demo}</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {teacher.subjects.slice(0, 3).map((s) => (
          <Badge key={s.subjectId} tone="blue">
            {localized(locale, s.subject.name, s.subject.nameAr)}
          </Badge>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-muted">
        {teacher.ratingCount > 0 ? <Stars value={teacher.ratingAvg} count={teacher.ratingCount} /> : <span>{t.common.noRating}</span>}
        {teacher.city && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-4 w-4" aria-hidden /> {teacher.city}
          </span>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <div className="flex gap-2 text-ink-muted">
          {teacher.offersOnline && <Monitor className="h-4 w-4" aria-label={t.enums.lessonMode.ONLINE} />}
          {teacher.offersInPerson && <Users className="h-4 w-4" aria-label={t.enums.lessonMode.IN_PERSON} />}
        </div>
        {from !== null && <span className="text-sm font-semibold text-ink">{fmt(t.student.priceFrom, { price: formatMoney(from, locale) })}</span>}
      </div>
    </Link>
  );
}
