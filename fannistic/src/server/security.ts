import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { prisma } from "./db";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function error(code: string, status: number, extra: Record<string, unknown> = {}) {
  return json({ error: code, ...extra }, status);
}

/**
 * Protection CSRF : toute requête qui modifie des données doit venir du site lui-même.
 * Les cookies sont en SameSite=Lax ; on vérifie en plus l'en-tête Origin.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function hashIp(ip: string) {
  return createHmac("sha256", process.env.AUTH_SECRET || "dev").update(ip).digest("hex").slice(0, 32);
}

export function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function makeReference(now = new Date()) {
  const bytes = randomBytes(6);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `FAN-${yymm}-${code}`;
}

/** Limiteur de débit stocké en base (fonctionne avec plusieurs instances). */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  if (count >= limit) return false;
  await prisma.rateLimitHit.create({ data: { key } });
  if (Math.random() < 0.02) {
    await prisma.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
  }
  return true;
}

function sealKey() {
  return createHash("sha256").update(`seal:${process.env.AUTH_SECRET || "dev"}`).digest();
}

/** Chiffrement AES-256-GCM d'une courte chaîne (jetons de suivi). */
export function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", sealKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64url");
}

export function unseal(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  try {
    const buf = Buffer.from(sealed, "base64url");
    const d = createDecipheriv("aes-256-gcm", sealKey(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
