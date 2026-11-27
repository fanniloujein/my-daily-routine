import type { BookingStatus, LessonMode, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/action";
import {
  ACTIVE_BOOKING_STATUSES,
  MAX_BOOKING_DAYS_AHEAD,
  checkTransition,
  generateSlots,
  isSlotOffered,
  lessonPrice,
  type Slot,
} from "@/lib/domain/booking";
import { addDaysIso, formatDateTime, isValidIsoDate, toLocalIsoDate, zonedTimeToUtc } from "@/lib/time";
import { localized } from "@/lib/i18n/config";
import { notify } from "./notify";
import { audit } from "./audit";

/** Teste si une erreur Postgres provient de la contrainte d'exclusion anti-chevauchement. */
export function isOverlapViolation(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("booking_no_overlap") || msg.includes("23P01");
}

function withinBookingWindow(date: string, now: Date) {
  const today = toLocalIsoDate(now);
  return date >= today && date <= addDaysIso(today, MAX_BOOKING_DAYS_AHEAD);
}

/** Enseignant réservable : validé, compte actif. */
async function loadBookableTeacher(teacherId: string) {
  const teacher = await prisma.teacherProfile.findUnique({
    where: { id: teacherId },
    include: {
      user: { select: { id: true, name: true, status: true } },
      subjects: true,
      availabilities: { where: { isActive: true } },
    },
  });
  if (!teacher || teacher.status !== "APPROVED" || teacher.user.status !== "ACTIVE") {
    throw new AppError("teacherUnavailable");
  }
  return teacher;
}

/** Créneaux libres d'un enseignant pour une date locale (recalculés côté serveur). */
export async function getTeacherSlots(teacherId: string, date: string, now = new Date()): Promise<Slot[]> {
  if (!isValidIsoDate(date) || !withinBookingWindow(date, now)) return [];
  const teacher = await loadBookableTeacher(teacherId);
  const dayStart = zonedTimeToUtc(date, 0);
  const dayEnd = zonedTimeToUtc(addDaysIso(date, 1), 0);
  const busy = await prisma.booking.findMany({
    where: {
      teacherId,
      status: { in: ACTIVE_BOOKING_STATUSES },
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
    },
    select: { startsAt: true, endsAt: true },
  });
  return generateSlots({
    date,
    availabilities: teacher.availabilities,
    durationMinutes: teacher.lessonDurationMinutes,
    busy,
    now,
    teacherModes: { online: teacher.offersOnline, inPerson: teacher.offersInPerson },
  });
}

export async function createBooking(input: {
  studentId: string;
  teacherId: string;
  subjectId: string;
  mode: LessonMode;
  startsAt: Date;
  note?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const teacher = await loadBookableTeacher(input.teacherId);
  if (teacher.userId === input.studentId) throw new AppError("selfAction");
  if (!teacher.subjects.some((s) => s.subjectId === input.subjectId)) throw new AppError("subjectNotTaught");
  if ((input.mode === "ONLINE" && !teacher.offersOnline) || (input.mode === "IN_PERSON" && !teacher.offersInPerson)) {
    throw new AppError("modeNotOffered");
  }
  const price = lessonPrice(input.mode, teacher);
  if (price === null) throw new AppError("priceMissing");

  const date = toLocalIsoDate(input.startsAt);
  const slots = await getTeacherSlots(teacher.id, date, now);
  const slot = isSlotOffered(slots, input.startsAt, input.mode);
  if (!slot) throw new AppError("slotUnavailable");

  const ownOverlap = await prisma.booking.count({
    where: {
      studentId: input.studentId,
      status: { in: ACTIVE_BOOKING_STATUSES },
      startsAt: { lt: slot.endsAt },
      endsAt: { gt: slot.startsAt },
    },
  });
  if (ownOverlap > 0) throw new AppError("ownOverlap");

  let booking;
  try {
    booking = await prisma.booking.create({
      data: {
        studentId: input.studentId,
        teacherId: teacher.id,
        subjectId: input.subjectId,
        mode: input.mode,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: "PENDING",
        priceMillimes: price,
        studentNote: input.note,
        location: input.mode === "IN_PERSON" ? teacher.inPersonArea : null,
      },
      include: { subject: true, student: { select: { name: true } } },
    });
  } catch (e) {
    // Une autre demande a pris le créneau entre la vérification et l'insertion.
    if (isOverlapViolation(e)) throw new AppError("slotUnavailable");
    throw e;
  }

  await notify(
    teacher.userId,
    "bookingRequested",
    (l) => ({
      student: booking.student.name,
      subject: localized(l, booking.subject.name, booking.subject.nameAr),
      date: formatDateTime(booking.startsAt, l),
    }),
    "/teacher/bookings",
  );
  return booking;
}

export async function transitionBooking(input: {
  bookingId: string;
  actor: { userId: string; role: Role };
  to: BookingStatus;
  reason?: string;
  meetingLink?: string;
  location?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { teacher: { include: { user: { select: { id: true, name: true } } } }, subject: true },
  });
  if (!booking) throw new AppError("notFound");

  const { role, userId } = input.actor;
  if (role === "STUDENT" && booking.studentId !== userId) throw new AppError("notFound");
  if (role === "TEACHER" && booking.teacher.userId !== userId) throw new AppError("notFound");

  const check = checkTransition({ from: booking.status, to: input.to, actor: role, booking, now });
  if (!check.ok) throw new AppError(check.reason === "FORBIDDEN" ? "forbidden" : check.reason === "TOO_LATE_TO_CANCEL" ? "tooLateToCancel" : check.reason === "NOT_FINISHED" ? "notFinished" : "invalidTransition");

  const data: Record<string, unknown> = { status: input.to };
  if (input.to === "ACCEPTED") {
    data.respondedAt = now;
    if (booking.mode === "ONLINE" && input.meetingLink) data.meetingLink = input.meetingLink;
    if (booking.mode === "IN_PERSON" && input.location) data.location = input.location;
  } else if (input.to === "REJECTED") {
    data.respondedAt = now;
    data.rejectionReason = input.reason;
  } else if (input.to === "CANCELLED") {
    data.cancelledAt = now;
    data.cancelReason = input.reason;
    data.cancelledByRole = role;
  } else if (input.to === "COMPLETED") {
    data.completedAt = now;
  }

  // Mise à jour conditionnelle : si le statut a changé entre-temps, rien n'est écrit.
  const res = await prisma.booking.updateMany({ where: { id: booking.id, status: booking.status }, data });
  if (res.count === 0) throw new AppError("invalidTransition");
  if (role === "ADMIN") await audit(userId, `booking.${input.to.toLowerCase()}`, "Booking", booking.id);

  const subjectName = (l: "fr" | "ar") => localized(l, booking.subject.name, booking.subject.nameAr);
  const when = (l: "fr" | "ar") => formatDateTime(booking.startsAt, l);
  const teacherName = booking.teacher.user.name;
  if (input.to === "ACCEPTED") {
    await notify(booking.studentId, "bookingAccepted", (l) => ({ teacher: teacherName, subject: subjectName(l), date: when(l) }), "/student/bookings");
  } else if (input.to === "REJECTED") {
    await notify(booking.studentId, "bookingRejected", (l) => ({ teacher: teacherName, date: when(l) }), "/student/bookings");
  } else if (input.to === "CANCELLED") {
    const target = role === "STUDENT" ? booking.teacher.userId : booking.studentId;
    const link = role === "STUDENT" ? "/teacher/bookings" : "/student/bookings";
    await notify(target, "bookingCancelled", (l) => ({ subject: subjectName(l), date: when(l) }), link);
    if (role === "ADMIN") {
      await notify(booking.teacher.userId, "bookingCancelled", (l) => ({ subject: subjectName(l), date: when(l) }), "/teacher/bookings");
    }
  } else if (input.to === "COMPLETED") {
    await notify(booking.studentId, "bookingCompleted", { teacher: teacherName }, "/student/bookings");
  }
  return { ...booking, status: input.to };
}

export async function reviewBooking(input: { bookingId: string; studentId: string; rating: number; comment?: string }) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new AppError("invalidNumber");
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { review: true, teacher: true },
  });
  if (!booking || booking.studentId !== input.studentId) throw new AppError("notFound");
  if (booking.status !== "COMPLETED") throw new AppError("invalidTransition");
  if (booking.review) throw new AppError("alreadyReviewed");

  await prisma.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        bookingId: booking.id,
        studentId: input.studentId,
        teacherId: booking.teacherId,
        rating: input.rating,
        comment: input.comment,
      },
    });
    const agg = await tx.review.aggregate({
      where: { teacherId: booking.teacherId, isVisible: true },
      _avg: { rating: true },
      _count: true,
    });
    await tx.teacherProfile.update({
      where: { id: booking.teacherId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
  });
  await notify(booking.teacher.userId, "reviewReceived", { rating: input.rating }, "/teacher");
}
