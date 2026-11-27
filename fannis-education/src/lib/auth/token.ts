/**
 * Jetons de session (JWT HS256). Compatible Edge (middleware) et Node.
 */
import { SignJWT, jwtVerify } from "jose";

export type SessionRole = "STUDENT" | "TEACHER" | "ADMIN";

export interface SessionPayload {
  sub: string;
  role: SessionRole;
  /** sessionVersion de l'utilisateur au moment de la connexion. */
  v: number;
}

export const SESSION_COOKIE = "fe_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secretKey(secret = process.env.AUTH_SECRET): Uint8Array {
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum).");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, secret?: string): Promise<string> {
  return new SignJWT({ role: payload.role, v: payload.v })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey(secret));
}

export async function verifySession(token: string | undefined, secret?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: ["HS256"] });
    const role = payload.role;
    if (typeof payload.sub !== "string" || typeof payload.v !== "number") return null;
    if (role !== "STUDENT" && role !== "TEACHER" && role !== "ADMIN") return null;
    return { sub: payload.sub, role, v: payload.v };
  } catch {
    return null;
  }
}

/** Espace par défaut de chaque rôle. */
export function homeForRole(role: SessionRole): string {
  return role === "ADMIN" ? "/admin" : role === "TEACHER" ? "/teacher" : "/student";
}

/** Rôle requis pour un chemin privé (null = public). */
export function requiredRoleForPath(pathname: string): SessionRole | null {
  if (pathname === "/student" || pathname.startsWith("/student/")) return "STUDENT";
  if (pathname === "/teacher" || pathname.startsWith("/teacher/")) return "TEACHER";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "ADMIN";
  return null;
}

/** Évite les redirections ouvertes : seuls les chemins internes sont acceptés. */
export function safeRedirectPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
