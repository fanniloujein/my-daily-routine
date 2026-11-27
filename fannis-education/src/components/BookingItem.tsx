import type { ReactNode } from "react";
import { MapPin, Video } from "lucide-react";
import type { Booking, Subject } from "@prisma/client";
import { fmt, localized, type AppLocale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dict";
import { formatMoney } from "@/lib/money";
import { formatDateTime, formatTime } from "@/lib/time";
import { Badge, type Tone } from "@/components/ui";

export const BOOKING_TONE: Record<Booking["status"], Tone> = { PENDING: "yellow", ACCEPTED: "green", REJECTED: "red", COMPLETED: "blue", CANCELLED: "gray" };

export function BookingItem({ b, who, t, locale, actions, children }: { b: Booking & { subject: Subject }; who: string; t: Dict; locale: AppLocale; actions?: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{localized(locale, b.subject.name, b.subject.nameAr)}</p>
          <Badge tone={BOOKING_TONE[b.status]}>{t.enums.bookingStatus[b.status]}</Badge>
          <Badge>{t.enums.lessonMode[b.mode]}</Badge>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {formatDateTime(b.startsAt, locale)} – {formatTime(b.endsAt, locale)} · {who} · {formatMoney(b.priceMillimes, locale)}
        </p>
        {b.status === "ACCEPTED" && b.meetingLink && (
          <a href={b.meetingLink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline" dir="ltr">
            <Video className="h-4 w-4" aria-hidden /> {t.student.bookingMeeting}
          </a>
        )}
        {b.mode === "IN_PERSON" && b.location && <p className="mt-1 inline-flex items-center gap-1 text-sm text-ink-muted"><MapPin className="h-4 w-4" aria-hidden /> {b.location}</p>}
        {b.studentNote && <p className="mt-1 text-sm text-ink-muted">« {b.studentNote} »</p>}
        {b.status === "REJECTED" && b.rejectionReason && <p className="mt-1 text-sm text-red-600">{fmt(t.student.bookingRejected, { reason: b.rejectionReason })}</p>}
        {b.status === "CANCELLED" && b.cancelReason && <p className="mt-1 text-sm text-ink-muted">{t.common.reason} : {b.cancelReason}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </li>
  );
}
