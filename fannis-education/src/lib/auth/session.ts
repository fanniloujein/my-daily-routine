import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySession,
  type SessionRole,
} from "./token";

export async function createSession(user: { id: string; role: SessionRole; sessionVersion: number }) {
  const token = await signSession({ sub: user.id, role: user.role, v: user.sessionVersion });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Utilisateur courant, relu en base (statut, révocation). Mis en cache pour la requête. */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const payload = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      locale: true,
      sessionVersion: true,
    },
  });
  if (!user || user.status !== "ACTIVE" || user.sessionVersion !== payload.v || user.role !== payload.role) {
    return null;
  }
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** À appeler dans chaque page/action privée. Redirige si non autorisé. */
export async function requireUser(...roles: SessionRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length > 0 && !roles.includes(user.role)) redirect("/");
  return user;
}
