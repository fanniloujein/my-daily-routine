"use server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";
import { getCurrentUser } from "@/lib/auth/session";

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) await prisma.user.update({ where: { id: user.id }, data: { locale: locale === "ar" ? "AR" : "FR" } });
}
