import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export async function GET() {
  let count: number;
  try {
    count = await prisma.user.count();
  } catch {
    return NextResponse.json({ error: "Base de données inaccessible. Ouvre /api/health pour le diagnostic." }, { status: 503 });
  }
  const userId = await getUserId();
  return NextResponse.json({ hasUser: count > 0, signupAllowed: count === 0 || process.env.ALLOW_SIGNUP === "true", authenticated: !!userId });
}
