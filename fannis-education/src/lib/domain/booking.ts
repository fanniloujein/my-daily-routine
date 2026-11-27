/**
 * Règles de réservation — logique pure, testée unitairement.
 */
import { dayOfWeekOf, zonedTimeToUtc } from "../time";

export type BookingStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED" | "CANCELLED";
export type LessonMode = "ONLINE" | "IN_PERSON";
export type Role = "STUDENT" | "TEACHER" | "ADMIN";

/** Statuts qui bloquent un créneau. */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ["PENDING", "ACCEPTED"];

/** Délai minimal entre la demande et la séance. */
export const MIN_LEAD_MINUTES = 12 * 60;
/** Fenêtre de réservation. */
export const MAX_BOOKING_DAYS_AHEAD = 60;
/** Un élève peut annuler une séance acceptée jusqu'à ce délai avant le début. */
export const STUDENT_CANCEL_DEADLINE_HOURS = 24;

export interface Interval {
  startsAt: Date;
  endsAt: Date;
}

/** Intervalles semi-ouverts [début, fin) : se toucher n'est pas se chevaucher. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}

export interface AvailabilityRule {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  mode: LessonMode | null;
  isActive?: boolean;
}

export interface Slot extends Interval {
  modes: LessonMode[];
}

/**
 * Créneaux réservables pour une date locale (YYYY-MM-DD).
 * - découpe chaque disponibilité en séances de `durationMinutes` alignées sur la disponibilité ;
 * - ne garde que les modes proposés par l'enseignant ;
 * - retire les créneaux trop proches (`minLeadMinutes`) ou déjà occupés.
 */
export function generateSlots(params: {
  date: string;
  availabilities: AvailabilityRule[];
  durationMinutes: number;
  busy: Interval[];
  now: Date;
  teacherModes: { online: boolean; inPerson: boolean };
  minLeadMinutes?: number;
}): Slot[] {
  const { date, availabilities, durationMinutes, busy, now, teacherModes } = params;
  const minLead = params.minLeadMinutes ?? MIN_LEAD_MINUTES;
  if (durationMinutes <= 0) return [];
  const dow = dayOfWeekOf(date);
  const earliest = now.getTime() + minLead * 60000;
  const byStart = new Map<number, Slot>();

  for (const rule of availabilities) {
    if (rule.isActive === false || rule.dayOfWeek !== dow) continue;
    const modes = allowedModes(rule.mode, teacherModes);
    if (modes.length === 0) continue;
    for (let m = rule.startMinute; m + durationMinutes <= rule.endMinute; m += durationMinutes) {
      const startsAt = zonedTimeToUtc(date, m);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);
      if (startsAt.getTime() < earliest) continue;
      if (busy.some((b) => overlaps({ startsAt, endsAt }, b))) continue;
      const key = startsAt.getTime();
      const existing = byStart.get(key);
      if (existing) {
        existing.modes = Array.from(new Set([...existing.modes, ...modes]));
      } else {
        byStart.set(key, { startsAt, endsAt, modes });
      }
    }
  }
  return [...byStart.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function allowedModes(ruleMode: LessonMode | null, t: { online: boolean; inPerson: boolean }): LessonMode[] {
  const out: LessonMode[] = [];
  if ((ruleMode === null || ruleMode === "ONLINE") && t.online) out.push("ONLINE");
  if ((ruleMode === null || ruleMode === "IN_PERSON") && t.inPerson) out.push("IN_PERSON");
  return out;
}

/** Le créneau demandé fait-il partie des créneaux proposés, pour ce mode ? */
export function isSlotOffered(slots: Slot[], startsAt: Date, mode: LessonMode): Slot | null {
  return slots.find((s) => s.startsAt.getTime() === startsAt.getTime() && s.modes.includes(mode)) ?? null;
}

/** Prix d'une séance selon le mode (null si le mode n'est pas tarifé → non réservable). */
export function lessonPrice(
  mode: LessonMode,
  teacher: { onlinePriceMillimes: number | null; inPersonPriceMillimes: number | null },
): number | null {
  const p = mode === "ONLINE" ? teacher.onlinePriceMillimes : teacher.inPersonPriceMillimes;
  return p != null && p >= 0 ? p : null;
}

export type TransitionCheck = { ok: true } | { ok: false; reason: TransitionError };
export type TransitionError = "INVALID_TRANSITION" | "FORBIDDEN" | "TOO_LATE_TO_CANCEL" | "NOT_FINISHED";

/**
 * Machine à états des réservations.
 * PENDING  → ACCEPTED | REJECTED (enseignant) ; → CANCELLED (tous)
 * ACCEPTED → COMPLETED (enseignant/admin, après la fin) ; → CANCELLED (élève ≥ 24 h avant, enseignant, admin)
 * REJECTED, COMPLETED, CANCELLED : états finaux.
 */
export function checkTransition(params: {
  from: BookingStatus;
  to: BookingStatus;
  actor: Role;
  booking: Interval;
  now: Date;
}): TransitionCheck {
  const { from, to, actor, booking, now } = params;
  const fail = (reason: TransitionError): TransitionCheck => ({ ok: false, reason });

  if (from === "PENDING") {
    if (to === "ACCEPTED" || to === "REJECTED") return actor === "TEACHER" ? { ok: true } : fail("FORBIDDEN");
    if (to === "CANCELLED") return { ok: true };
    return fail("INVALID_TRANSITION");
  }
  if (from === "ACCEPTED") {
    if (to === "COMPLETED") {
      if (actor === "STUDENT") return fail("FORBIDDEN");
      return booking.endsAt.getTime() <= now.getTime() ? { ok: true } : fail("NOT_FINISHED");
    }
    if (to === "CANCELLED") {
      if (actor === "STUDENT") {
        const deadline = booking.startsAt.getTime() - STUDENT_CANCEL_DEADLINE_HOURS * 3600_000;
        return now.getTime() <= deadline ? { ok: true } : fail("TOO_LATE_TO_CANCEL");
      }
      return { ok: true };
    }
    return fail("INVALID_TRANSITION");
  }
  return fail("INVALID_TRANSITION");
}

/** Vérifie qu'une liste de disponibilités ne contient pas de chevauchement le même jour. */
export function findAvailabilityOverlap(rules: AvailabilityRule[]): [number, number] | null {
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      if (a.dayOfWeek === b.dayOfWeek && a.startMinute < b.endMinute && b.startMinute < a.endMinute) return [i, j];
    }
  }
  return null;
}
