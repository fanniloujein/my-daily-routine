import { z } from "zod";
import { prisma } from "@/server/db";
import { getSessionUser, hashPassword, startSession, verifyPassword } from "@/server/auth";
import { error, json, sameOrigin } from "@/server/security";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error("forbidden", 403);
  const user = await getSessionUser();
  if (!user) return error("unauthorized", 401);
  const parsed = z.object({ current: z.string().max(200), next: z.string().min(12).max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("bad_request", 400, { message: "Le nouveau mot de passe doit contenir au moins 12 caractères." });
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(parsed.data.current, row.passwordHash))) return error("bad_request", 400, { message: "Mot de passe actuel incorrect." });
  // Le changement invalide toutes les autres sessions ouvertes.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.next), tokenVersion: { increment: 1 } },
  });
  await startSession(updated);
  return json({ ok: true });
}
