import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";

export const SESSION_COOKIE = "fs_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET manquant ou trop court");
    return new TextEncoder().encode("dev-only-secret-change-me-please");
  }
  return new TextEncoder().encode(s);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function startSession(user: Pick<User, "id" | "role" | "tokenVersion">) {
  const token = await new SignJWT({ role: user.role, v: user.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "locale">;

/** Utilisateur connecté, revérifié en base (rôle et version de jeton à jour). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.tokenVersion !== payload.v) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role, locale: user.locale };
  } catch {
    return null;
  }
}

export async function requireRole(role: Role): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  if (role === "ADMIN" && user.role !== "ADMIN") return null;
  return user;
}

/** Vérification légère (sans base) utilisée par le middleware. */
export async function readSessionRole(token: string | undefined): Promise<Role | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return (payload.role as Role) ?? null;
  } catch {
    return null;
  }
}
