"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AppError, runAction, zodFail, type ActionResult } from "@/lib/action";
import { requireUser } from "@/lib/auth/session";
import { isValidIsoDate } from "@/lib/time";
import { getViewer, lessonAccessible } from "@/server/content";
import { cancelPendingRequest, requestSubscription } from "@/server/subscriptions";
import { createBooking, getTeacherSlots, reviewBooking, transitionBooking } from "@/server/bookings";
import { submitQuizAttempt } from "@/server/quizzes";
import { bookingRequestSchema, reviewSchema, studentProfileSchema, subscriptionRequestSchema } from "@/lib/validation/student";

export async function markLessonDoneAction(courseId: string, lessonId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("STUDENT");
    const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, courseId, course: { status: "PUBLISHED" } }, include: { course: true } });
    if (!lesson) throw new AppError("notFound");
    if (!lessonAccessible(await getViewer(user), lesson.course, lesson)) throw new AppError("forbidden");
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      update: {},
      create: { userId: user.id, lessonId },
    });
    revalidatePath(`/student/courses/${courseId}`);
    return { ok: true };
  });
}

export async function submitQuizAction(quizId: string, answers: Record<string, number[]>, startedAtIso: string): Promise<ActionResult<{ attemptId: string }>> {
  return runAction(async () => {
    const user = await requireUser("STUDENT");
    const startedAt = new Date(startedAtIso);
    const { attempt } = await submitQuizAttempt({ quizId, user, answers, startedAt: isNaN(startedAt.getTime()) ? new Date() : startedAt });
    revalidatePath("/student/progress");
    return { ok: true, data: { attemptId: attempt.id } };
  });
}

export async function requestSubscriptionAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("STUDENT");
    const parsed = subscriptionRequestSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    await requestSubscription({ userId: user.id, ...parsed.data });
    revalidatePath("/student/subscription");
    return { ok: true };
  });
}

export async function cancelSubscriptionRequestAction(subscriptionId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("STUDENT");
    await cancelPendingRequest(user.id, subscriptionId);
    revalidatePath("/student/subscription");
    return { ok: true };
  });
}

export async function getSlotsAction(teacherId: string, date: string): Promise<ActionResult<{ startsAt: string; endsAt: string; modes: string[] }[]>> {
  return runAction(async () => {
    await requireUser("STUDENT");
    if (!isValidIsoDate(date)) throw new AppError("invalidDate");
    const slots = await getTeacherSlots(teacherId, date);
    return { ok: true, data: slots.map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), modes: s.modes })) };
  });
}

export async function createBookingAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("STUDENT");
    const parsed = bookingRequestSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const d = parsed.data;
    await createBooking({ studentId: user.id, teacherId: d.teacherId, subjectId: d.subjectId, mode: d.mode, startsAt: new Date(d.startsAt), note: d.note });
    revalidatePath("/student/bookings");
    return { ok: true };
  });
}

export async function cancelBookingAction(bookingId: string, reason?: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("STUDENT");
    await transitionBooking({ bookingId, actor: { userId: user.id, role: "STUDENT" }, to: "CANCELLED", reason: reason?.slice(0, 500) });
    revalidatePath("/student/bookings");
    return { ok: true };
  });
}

export async function reviewBookingAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("STUDENT");
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    await reviewBooking({ ...parsed.data, studentId: user.id });
    revalidatePath("/student/bookings");
    return { ok: true };
  });
}

export async function updateStudentProfileAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("STUDENT");
    const parsed = studentProfileSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const d = parsed.data;
    const level = await prisma.educationalLevel.findFirst({ where: { id: d.levelId, isActive: true } });
    if (!level) return { ok: false, error: "validation", fieldErrors: { levelId: "required" } };
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: d.name,
        phone: d.phone ?? null,
        studentProfile: {
          upsert: {
            create: { levelId: level.id, city: d.city, school: d.school, guardianPhone: d.guardianPhone },
            update: { levelId: level.id, city: d.city ?? null, school: d.school ?? null, guardianPhone: d.guardianPhone ?? null },
          },
        },
      },
    });
    revalidatePath("/student", "layout");
    return { ok: true };
  });
}
