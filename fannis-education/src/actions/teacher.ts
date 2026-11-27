"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError, runAction, zodFail, type ActionResult } from "@/lib/action";
import { requireUser } from "@/lib/auth/session";
import { findAvailabilityOverlap } from "@/lib/domain/booking";
import { transitionBooking } from "@/server/bookings";
import { availabilitySchema, teacherProfileSchema } from "@/lib/validation/teacher";

async function myProfile(userId: string) {
  const p = await prisma.teacherProfile.findUnique({ where: { userId } });
  if (!p) throw new AppError("notFound");
  return p;
}

export async function updateTeacherProfileAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("TEACHER");
    const parsed = teacherProfileSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const d = parsed.data;
    const profile = await myProfile(user.id);
    const subjects = await prisma.subject.findMany({ where: { id: { in: d.subjectIds }, isActive: true }, select: { id: true } });
    if (subjects.length === 0) return { ok: false, error: "validation", fieldErrors: { subjectIds: "selectSubject" } };
    await prisma.$transaction([
      prisma.teacherProfile.update({
        where: { id: profile.id },
        data: {
          headline: d.headline,
          bio: d.bio ?? null,
          city: d.city,
          yearsExperience: d.yearsExperience,
          offersOnline: d.offersOnline,
          offersInPerson: d.offersInPerson,
          onlinePriceMillimes: d.onlinePrice,
          inPersonPriceMillimes: d.inPersonPrice,
          inPersonArea: d.inPersonArea ?? null,
          lessonDurationMinutes: d.lessonDurationMinutes,
        },
      }),
      prisma.teacherSubject.deleteMany({ where: { teacherId: profile.id, subjectId: { notIn: subjects.map((s) => s.id) } } }),
      prisma.teacherSubject.createMany({ data: subjects.map((s) => ({ teacherId: profile.id, subjectId: s.id })), skipDuplicates: true }),
    ]);
    revalidatePath("/teacher", "layout");
    return { ok: true };
  });
}

export async function saveAvailabilityAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("TEACHER");
    const parsed = availabilitySchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const rules = parsed.data.slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startMinute: s.start,
      endMinute: s.end,
      mode: s.mode === "BOTH" ? null : s.mode,
    }));
    if (findAvailabilityOverlap(rules)) throw new AppError("availabilityOverlap");
    const profile = await myProfile(user.id);
    // Remplacer les plages n'annule pas les réservations déjà acceptées.
    await prisma.$transaction([
      prisma.teacherAvailability.deleteMany({ where: { teacherId: profile.id } }),
      prisma.teacherAvailability.createMany({ data: rules.map((r) => ({ ...r, teacherId: profile.id })) }),
    ]);
    revalidatePath("/teacher/availability");
    return { ok: true };
  });
}

const linkSchema = z.union([z.literal(""), z.url({ protocol: /^https$/ }).max(500)]);

export async function acceptBookingAction(bookingId: string, value?: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("TEACHER");
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { mode: true } });
    if (!booking) throw new AppError("notFound");
    const v = (value ?? "").trim();
    if (booking.mode === "ONLINE" && !linkSchema.safeParse(v).success) throw new AppError("validation");
    await transitionBooking({
      bookingId,
      actor: { userId: user.id, role: "TEACHER" },
      to: "ACCEPTED",
      meetingLink: booking.mode === "ONLINE" && v ? v : undefined,
      location: booking.mode === "IN_PERSON" && v ? v.slice(0, 300) : undefined,
    });
    revalidatePath("/teacher", "layout");
    return { ok: true };
  });
}

export async function rejectBookingAction(bookingId: string, reason?: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("TEACHER");
    await transitionBooking({ bookingId, actor: { userId: user.id, role: "TEACHER" }, to: "REJECTED", reason: reason?.slice(0, 500) });
    revalidatePath("/teacher", "layout");
    return { ok: true };
  });
}

export async function completeBookingAction(bookingId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("TEACHER");
    await transitionBooking({ bookingId, actor: { userId: user.id, role: "TEACHER" }, to: "COMPLETED" });
    revalidatePath("/teacher", "layout");
    return { ok: true };
  });
}

export async function teacherCancelBookingAction(bookingId: string, reason?: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("TEACHER");
    await transitionBooking({ bookingId, actor: { userId: user.id, role: "TEACHER" }, to: "CANCELLED", reason: reason?.slice(0, 500) });
    revalidatePath("/teacher", "layout");
    return { ok: true };
  });
}
