import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionCookie, hashPassword } from "@/lib/auth";
import { body, errorResponse } from "@/lib/api";
import { setupSchema } from "@/lib/validation";
import { ensureReferenceData } from "@/server/reference";
import { seedDemo } from "@/server/demo";

// Création du compte unique de l'administratrice (impossible une fois le compte créé).
export async function GET() {
  try {
    return NextResponse.json({ needsSetup: (await prisma.user.count()) === 0 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    if ((await prisma.user.count()) > 0) return NextResponse.json({ error: "Le compte administratrice existe déjà." }, { status: 403 });
    const v = await body(req, setupSchema);
    const user = await prisma.user.create({
      data: { name: v.name, email: v.email, passwordHash: await hashPassword(v.password), settings: { teacherName: v.name } },
    });
    await ensureReferenceData();
    if (v.demo) await seedDemo();
    await createSessionCookie(user.id, user.tokenVersion);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
