import { prisma } from "@/lib/db";
import { route } from "@/lib/api";

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.leisureIdea.deleteMany({ where: { id: params.id, userId: user.id } });
  return { ok: true };
});
