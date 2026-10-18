import { z } from "zod";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/auth";
import { error, json, sameOrigin, sha256 } from "@/server/security";

/** Rattache une demande envoyée sans compte au compte connecté (preuve : le lien de suivi). */
export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  if (!sameOrigin(req)) return error("forbidden", 403);
  const user = await getSessionUser();
  if (!user) return error("unauthorized", 401);
  const { reference } = await params;
  const parsed = z.object({ t: z.string().min(10).max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("bad_request", 400);
  const request = await prisma.projectRequest.findUnique({ where: { reference } });
  if (!request || request.accessTokenHash !== sha256(parsed.data.t)) return error("not_found", 404);
  if (request.userId && request.userId !== user.id) return error("already_linked", 409);
  await prisma.projectRequest.update({ where: { id: request.id }, data: { userId: user.id } });
  return json({ ok: true });
}
