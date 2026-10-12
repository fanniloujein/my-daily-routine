import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export async function GET() {
  const count = await prisma.user.count();
  const userId = await getUserId();
  return NextResponse.json({ hasUser: count > 0, signupAllowed: count === 0 || process.env.ALLOW_SIGNUP === "true", authenticated: !!userId });
}
