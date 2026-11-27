"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppError, runAction, zodFail, type ActionResult } from "@/lib/action";
import { createSession, destroySession, requireUser } from "@/lib/auth/session";
import { fakeVerify, hashPassword, verifyPassword } from "@/lib/auth/password";
import { homeForRole, safeRedirectPath } from "@/lib/auth/token";
import { rateLimit } from "@/lib/rate-limit";
import { getLocale } from "@/lib/i18n/server";
import {
  changePasswordSchema,
  loginSchema,
  studentRegisterSchema,
  teacherRegisterSchema,
} from "@/lib/validation/auth";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function loginAction(input: unknown): Promise<ActionResult<{ redirect: string }>> {
  return runAction(async () => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { email, password, next } = parsed.data;

    const ip = await clientIp();
    if (!rateLimit(`login:${ip}:${email}`, 8, 15 * 60_000) || !rateLimit(`login-ip:${ip}`, 40, 15 * 60_000)) {
      throw new AppError("tooManyAttempts");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user ? await verifyPassword(password, user.passwordHash) : await fakeVerify(password);
    if (!user || !valid) throw new AppError("invalidCredentials");
    if (user.status !== "ACTIVE") throw new AppError("accountSuspended");

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(user);

    const home = homeForRole(user.role);
    const target = safeRedirectPath(next);
    return { ok: true, data: { redirect: target && target.startsWith(home) ? target : home } };
  });
}

export async function registerStudentAction(input: unknown): Promise<ActionResult<{ redirect: string }>> {
  return runAction(async () => {
    const parsed = studentRegisterSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const d = parsed.data;

    const ip = await clientIp();
    if (!rateLimit(`register:${ip}`, 10, 60 * 60_000)) throw new AppError("tooManyAttempts");

    const level = await prisma.educationalLevel.findFirst({ where: { id: d.levelId, isActive: true } });
    if (!level) return { ok: false, error: "validation", fieldErrors: { levelId: "required" } };
    if (await prisma.user.findUnique({ where: { email: d.email } })) {
      return { ok: false, error: "emailTaken", fieldErrors: { email: "emailTaken" } };
    }
    const locale = await getLocale();
    const user = await prisma.user.create({
      data: {
        email: d.email,
        name: d.name,
        phone: d.phone,
        passwordHash: await hashPassword(d.password),
        role: "STUDENT",
        locale: locale === "ar" ? "AR" : "FR",
        lastLoginAt: new Date(),
        studentProfile: { create: { levelId: level.id } },
      },
    });
    await createSession(user);
    return { ok: true, data: { redirect: "/student" } };
  });
}

export async function registerTeacherAction(input: unknown): Promise<ActionResult<{ redirect: string }>> {
  return runAction(async () => {
    const parsed = teacherRegisterSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const d = parsed.data;

    const ip = await clientIp();
    if (!rateLimit(`register:${ip}`, 10, 60 * 60_000)) throw new AppError("tooManyAttempts");

    if (await prisma.user.findUnique({ where: { email: d.email } })) {
      return { ok: false, error: "emailTaken", fieldErrors: { email: "emailTaken" } };
    }
    const subjects = await prisma.subject.findMany({ where: { id: { in: d.subjectIds }, isActive: true }, select: { id: true } });
    if (subjects.length === 0) return { ok: false, error: "validation", fieldErrors: { subjectIds: "selectSubject" } };

    const locale = await getLocale();
    const user = await prisma.user.create({
      data: {
        email: d.email,
        name: d.name,
        phone: d.phone,
        passwordHash: await hashPassword(d.password),
        role: "TEACHER",
        locale: locale === "ar" ? "AR" : "FR",
        lastLoginAt: new Date(),
        teacherProfile: {
          create: {
            status: "PENDING",
            city: d.city,
            headline: d.headline,
            subjects: { create: subjects.map((s) => ({ subjectId: s.id })) },
          },
        },
      },
    });
    await createSession(user);
    return { ok: true, data: { redirect: "/teacher" } };
  });
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return { ok: false, error: "wrongPassword", fieldErrors: { currentPassword: "wrongPassword" } };
    }
    // Incrémenter sessionVersion révoque toutes les sessions ouvertes.
    await prisma.user.update({
      where: { id: me.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword), sessionVersion: { increment: 1 } },
    });
    await destroySession();
    return { ok: true };
  });
}
