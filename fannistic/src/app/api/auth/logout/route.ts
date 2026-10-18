import { endSession } from "@/server/auth";
import { error, json, sameOrigin } from "@/server/security";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error("forbidden", 403);
  await endSession();
  return json({ ok: true });
}
