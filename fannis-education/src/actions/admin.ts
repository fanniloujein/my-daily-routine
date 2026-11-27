"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, runAction, zodFail, type ActionResult } from "@/lib/action";
import { requireUser } from "@/lib/auth/session";
import { cancelSubscription, confirmPayment, expireSubscriptions, extendSubscription, refundPayment, rejectPayment } from "@/server/subscriptions";
import { transitionBooking } from "@/server/bookings";
import { notify } from "@/server/notify";
import { audit } from "@/server/audit";
import { saveSettings } from "@/server/settings";
import { levelSchema, planSchema, settingsSchema, subjectSchema } from "@/lib/validation/admin";

const admin = () => requireUser("ADMIN");
const done = (path = "/admin"): ActionResult => {
  revalidatePath(path, "layout");
  return { ok: true };
};
const reason = (v?: string) => (v ?? "").trim().slice(0, 500) || undefined;

function uniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// ─────────── Paiements & abonnements ───────────
export async function confirmPaymentAction(paymentId: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await admin();
    await confirmPayment({ paymentId, adminId: me.id });
    return done();
  });
}

export async function rejectPaymentAction(paymentId: string, why?: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await admin();
    await rejectPayment({ paymentId, adminId: me.id, reason: reason(why) });
    return done();
  });
}

export async function refundPaymentAction(paymentId: string, why?: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await admin();
    await refundPayment({ paymentId, adminId: me.id, reason: reason(why) });
    return done();
  });
}

export async function cancelSubscriptionAction(subscriptionId: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await admin();
    await cancelSubscription({ subscriptionId, adminId: me.id });
    return done();
  });
}

export async function extendSubscriptionAction(subscriptionId: string, days?: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await admin();
    await extendSubscription({ subscriptionId, adminId: me.id, days: Number(days) });
    return done();
  });
}

export async function runExpiryAction(): Promise<ActionResult<number>> {
  return runAction(async () => {
    await admin();
    const n = await expireSubscriptions();
    revalidatePath("/admin", "layout");
    return { ok: true, data: n, message: `${n}` };
  });
}

// ─────────── Offres ───────────
export async function savePlanAction(planId: string | null, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await admin();
    const parsed = planSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { price, ...d } = parsed.data;
    const data = { ...d, priceMillimes: price, levelId: d.levelId ?? null };
    try {
      if (planId) await prisma.subscriptionPlan.update({ where: { id: planId }, data });
      else await prisma.subscriptionPlan.create({ data });
    } catch (e) {
      if (uniqueViolation(e)) return { ok: false, error: "slugTaken", fieldErrors: { code: "slugTaken" } };
      throw e;
    }
    await audit(me.id, planId ? "plan.update" : "plan.create", "SubscriptionPlan", planId ?? data.code, { priceMillimes: price });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function togglePlanAction(planId: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await admin();
    const p = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!p) throw new AppError("notFound");
    await prisma.subscriptionPlan.update({ where: { id: planId }, data: { isActive: !p.isActive } });
    await audit(me.id, "plan.toggle", "SubscriptionPlan", planId, { isActive: !p.isActive });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

// ─────────── Utilisateurs ───────────
export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED"): Promise<ActionResult> {
  return runAction(async () => {
    const me = await admin();
    if (userId === me.id) throw new AppError("selfAction");
    // Suspendre révoque immédiatement toutes les sessions (sessionVersion).
    await prisma.user.update({ where: { id: userId }, data: { status, ...(status === "SUSPENDED" ? { sessionVersion: { increment: 1 } } : {}) } });
    await audit(me.id, `user.${status.toLowerCase()}`, "User", userId);
    return done();
  });
}

// ─────────── Enseignants ───────────
export async function setTeacherStatusAction(teacherId: string, status: "APPROVED" | "REJECTED" | "SUSPENDED", why?: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await admin();
    const tp = await prisma.teacherProfile.update({
      where: { id: teacherId },
      data: { status, validatedAt: status === "APPROVED" ? new Date() : undefined, rejectionReason: status === "REJECTED" ? reason(why) ?? null : null },
    });
    await audit(me.id, `teacher.${status.toLowerCase()}`, "TeacherProfile", teacherId, { reason: reason(why) ?? null });
    if (status === "APPROVED") await notify(tp.userId, "teacherApproved", {}, "/teacher");
    if (status === "REJECTED") await notify(tp.userId, "teacherRejected", { reason: reason(why) ?? "" }, "/teacher/profile");
    return done("/");
  });
}

// ─────────── Catalogue ───────────
export async function saveLevelAction(levelId: string | null, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await admin();
    const parsed = levelSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    try {
      if (levelId) await prisma.educationalLevel.update({ where: { id: levelId }, data: parsed.data });
      else await prisma.educationalLevel.create({ data: parsed.data });
    } catch (e) {
      if (uniqueViolation(e)) return { ok: false, error: "slugTaken", fieldErrors: { slug: "slugTaken" } };
      throw e;
    }
    return done("/");
  });
}

export async function toggleLevelAction(levelId: string): Promise<ActionResult> {
  return runAction(async () => {
    await admin();
    const l = await prisma.educationalLevel.findUnique({ where: { id: levelId } });
    if (!l) throw new AppError("notFound");
    await prisma.educationalLevel.update({ where: { id: levelId }, data: { isActive: !l.isActive } });
    return done("/");
  });
}

export async function saveSubjectAction(subjectId: string | null, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await admin();
    const parsed = subjectSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    try {
      if (subjectId) await prisma.subject.update({ where: { id: subjectId }, data: parsed.data });
      else await prisma.subject.create({ data: parsed.data });
    } catch (e) {
      if (uniqueViolation(e)) return { ok: false, error: "slugTaken", fieldErrors: { slug: "slugTaken" } };
      throw e;
    }
    return done("/");
  });
}

export async function toggleSubjectAction(subjectId: string): Promise<ActionResult> {
  return runAction(async () => {
    await admin();
    const s = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!s) throw new AppError("notFound");
    await prisma.subject.update({ where: { id: subjectId }, data: { isActive: !s.isActive } });
    return done("/");
  });
}

// ─────────── Réservations, messages, paramètres ───────────
export async function adminCancelBookingAction(bookingId: string, why?: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await admin();
    await transitionBooking({ bookingId, actor: { userId: me.id, role: "ADMIN" }, to: "CANCELLED", reason: reason(why) });
    return done();
  });
}

export async function adminCompleteBookingAction(bookingId: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await admin();
    await transitionBooking({ bookingId, actor: { userId: me.id, role: "ADMIN" }, to: "COMPLETED" });
    return done();
  });
}

export async function markMessageHandledAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await admin();
    await prisma.contactMessage.update({ where: { id }, data: { handledAt: new Date() } });
    return done();
  });
}

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await admin();
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    await saveSettings({ ...parsed.data, contactPhone: parsed.data.contactPhone ?? "" });
    await audit(me.id, "settings.update", "PlatformSetting", "global");
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
