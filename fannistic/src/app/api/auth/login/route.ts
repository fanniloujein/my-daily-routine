import { z } from "zod";
import { prisma } from "@/server/db";
import { startSession, verifyPassword } from "@/server/auth";
import { clientIp, error, hashIp, json, rateLimit, sameOrigin } from "@/server/security";

const schema = z.object({ email: z.string().trim().toLowerCase().max(200), password: z.string().max(200), admin: z.boolean().optional() });

// Hash factice : le temps de réponse est le même que l'e-mail existe ou non.
const DUMMY = "$2b$12$4j5lsH2S0PdQdRtDP8pnF.rrl/I5QrtQm5iTgaQub/2qDWsZGvu6i";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error("forbidden", 403);
  const ip = hashIp(clientIp(req));
  if (!(await rateLimit(`login:${ip}`, 10, 15 * 60 * 1000))) return error("rate_limited", 429);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("invalid", 400);
  const { email, password, admin } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY);
  if (!user || !ok) return error("invalid", 401);
  if (admin && user.role !== "ADMIN") return error("invalid", 401);
  await startSession(user);
  return json({ ok: true, role: user.role });
}
