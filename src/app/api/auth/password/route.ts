import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, checkPassword, hashPassword } from "@/lib/auth";
import { body, route } from "@/lib/api";

const schema = z.object({ current: z.string().min(1), next: z.string().min(10, "10 caractères minimum").max(200) });

export const POST = route(async ({ req, user }) => {
  const data = await body(req, schema);
  if (!(await checkPassword(data.current, user.passwordHash))) throw new HttpError(400, "Mot de passe actuel incorrect.");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(data.next) } });
  return { ok: true };
});
