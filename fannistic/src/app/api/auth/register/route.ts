import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { hashPassword, startSession } from "@/server/auth";
import { clientIp, error, hashIp, json, rateLimit, sameOrigin } from "@/server/security";
import { isEmail } from "@/lib/services/logic";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().max(200).refine(isEmail),
  password: z.string().min(10).max(200),
  locale: z.enum(["fr", "en", "ar"]).default("fr"),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error("forbidden", 403);
  if (!(await rateLimit(`register:${hashIp(clientIp(req))}`, 10, 60 * 60 * 1000))) return error("rate_limited", 429);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const weak = parsed.error.issues.some((i) => i.path[0] === "password");
    return error(weak ? "weak_password" : "invalid", 400);
  }
  const { name, email, password, locale } = parsed.data;
  try {
    const user = await prisma.user.create({ data: { name, email, locale, passwordHash: await hashPassword(password), role: "CLIENT" } });
    await startSession(user);
    return json({ ok: true }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return error("exists", 409);
    throw e;
  }
}
