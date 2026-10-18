import type { RequestStatus } from "@prisma/client";

const TONES: Record<RequestStatus, string> = {
  RECEIVED: "bg-cyan-soft text-cyan-deep",
  IN_REVIEW: "bg-cyan-soft text-cyan-deep",
  INFO_NEEDED: "bg-gold-soft text-midnight",
  QUOTE_SENT: "bg-gold-soft text-midnight",
  QUOTE_ACCEPTED: "bg-success-soft text-success",
  IN_PROGRESS: "bg-midnight text-white",
  AWAITING_VALIDATION: "bg-gold-soft text-midnight",
  COMPLETED: "bg-success-soft text-success",
  CANCELLED: "bg-paper-3 text-ink-muted",
};

export function StatusBadge({ status, label }: { status: RequestStatus; label: string }) {
  return <span className={`badge ${TONES[status]}`}>{label}</span>;
}
