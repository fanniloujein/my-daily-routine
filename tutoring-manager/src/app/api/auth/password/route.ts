import { prisma } from "@/lib/db";
import { route, body, fail } from "@/lib/api";
import { checkPassword, createSessionCookie, hashPassword } from "@/lib/auth";
import { passwordSchema } from "@/lib/validation";

// Changement de mot de passe : les autres sessions ouvertes sont déconnectées.
export const POST = route(async ({ req, user }) => {
  const v = await body(req, passwordSchema);
  if (!(await checkPassword(v.current, user.passwordHash))) fail(400, "Mot de passe actuel incorrect.");
  const u = await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(v.next), tokenVersion: { increment: 1 } } });
  await createSessionCookie(u.id, u.tokenVersion);
});
