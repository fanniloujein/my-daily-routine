import type { Booking } from "@prisma/client";
import type { Dict } from "@/lib/i18n/dict";
import { acceptBookingAction, completeBookingAction, rejectBookingAction, teacherCancelBookingAction } from "@/actions/teacher";
import { ActionButton } from "@/components/client/ActionButton";

export function TeacherBookingActions({ b, t, now }: { b: Booking; t: Dict; now: Date }) {
  const tt = t.teacher;
  if (b.status === "PENDING") {
    return (
      <>
        <ActionButton
          variant="primary"
          action={acceptBookingAction.bind(null, b.id)}
          confirmText={tt.acceptTitle}
          input={b.mode === "ONLINE" ? { label: `${tt.meetingLink} (${t.common.optional})`, type: "url", placeholder: "https://" } : { label: `${tt.location} (${t.common.optional})`, defaultValue: b.location ?? "" }}
        >
          {tt.accept}
        </ActionButton>
        <ActionButton variant="danger" action={rejectBookingAction.bind(null, b.id)} input={{ label: tt.rejectReason }}>{tt.reject}</ActionButton>
      </>
    );
  }
  if (b.status === "ACCEPTED") {
    return (
      <>
        {b.endsAt <= now && <ActionButton variant="primary" action={completeBookingAction.bind(null, b.id)}>{tt.complete}</ActionButton>}
        <ActionButton variant="danger" action={teacherCancelBookingAction.bind(null, b.id)} input={{ label: tt.cancelReason, required: true }}>{tt.cancelBooking}</ActionButton>
      </>
    );
  }
  return null;
}
