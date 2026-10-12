import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { route } from "@/lib/api";

/** Génère (ou régénère) le lien secret d'abonnement au calendrier. */
export const POST = route(async ({ user }) => {
  const token = randomBytes(24).toString("base64url");
  await prisma.user.update({ where: { id: user.id }, data: { icsToken: token } });
  return { token };
});

/** Révoque le lien d'abonnement. */
export const DELETE = route(async ({ user }) => {
  await prisma.user.update({ where: { id: user.id }, data: { icsToken: null } });
  return { ok: true };
});

export const GET = route(async ({ user }) => ({ token: user.icsToken }));
