import { SignJWT, jwtVerify } from "jose";

// Jetons de session (utilisables dans le middleware Edge et côté serveur).
export const SESSION_COOKIE = "ftm_session";
export const SESSION_DAYS = 14;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET manquant ou trop court (16 caractères minimum).");
  return new TextEncoder().encode(s);
}

export async function signSession(userId: string, version: number): Promise<string> {
  return new SignJWT({ sub: userId, v: version })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifySession(token?: string): Promise<{ userId: string; version: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? { userId: payload.sub, version: Number(payload.v ?? 0) } : null;
  } catch {
    return null;
  }
}
