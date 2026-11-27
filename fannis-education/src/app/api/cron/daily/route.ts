import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { expireSubscriptions, sendExpiryReminders } from "@/server/subscriptions";

/** Tâche quotidienne : à appeler par un planificateur avec l'en-tête Authorization: Bearer <CRON_SECRET>. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const expired = await expireSubscriptions();
  const reminded = await sendExpiryReminders();
  return NextResponse.json({ ok: true, expired, reminded });
}
