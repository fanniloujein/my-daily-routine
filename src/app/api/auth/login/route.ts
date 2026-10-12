import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkPassword, createSessionCookie } from "@/lib/auth";
import { body, errorResponse } from "@/lib/api";

const schema = z.object({ email: z.string().trim().toLowerCase(), password: z.string().min(1) });

// Limitation simple des tentatives (en mémoire, par adresse IP)
const attempts = new Map<string, { count: number; until: number }>();

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const a = attempts.get(ip);
    if (a && a.count >= 5 && a.until > Date.now()) {
      return NextResponse.json({ error: "Trop de tentatives. Réessaie dans quelques minutes." }, { status: 429 });
    }
    const { email, password } = await body(req, schema);
    const user = await prisma.user.findUnique({ where: { email } });
    const ok = user ? await checkPassword(password, user.passwordHash) : false;
    if (!user || !ok) {
      const cur = a && a.until > Date.now() ? a : { count: 0, until: 0 };
      attempts.set(ip, { count: cur.count + 1, until: Date.now() + 10 * 60_000 });
      return NextResponse.json({ error: "E-mail ou mot de passe incorrect." }, { status: 401 });
    }
    attempts.delete(ip);
    await createSessionCookie(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
