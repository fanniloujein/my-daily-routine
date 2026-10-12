import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionCookie, hashPassword } from "@/lib/auth";
import { body, errorResponse } from "@/lib/api";
import { ensureDefaultCategories } from "@/server/categories";
import { DEFAULT_SETTINGS } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(1, "Prénom obligatoire").max(60),
  email: z.string().trim().toLowerCase().email("E-mail invalide"),
  password: z.string().min(10, "10 caractères minimum").max(200),
  demo: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const count = await prisma.user.count();
    if (count > 0 && process.env.ALLOW_SIGNUP !== "true") {
      return NextResponse.json({ error: "Un compte existe déjà. Connecte-toi." }, { status: 403 });
    }
    const data = await body(req, schema);
    if (await prisma.user.findUnique({ where: { email: data.email } })) {
      return NextResponse.json({ error: "Cet e-mail est déjà utilisé." }, { status: 409 });
    }
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash: await hashPassword(data.password), settings: DEFAULT_SETTINGS },
    });
    await ensureDefaultCategories(user.id);
    if (data.demo) {
      const { loadDemo } = await import("@/server/demo");
      await loadDemo(user.id);
    }
    await createSessionCookie(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
