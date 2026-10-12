import { prisma } from "@/lib/db";
import { route } from "@/lib/api";

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.resource.deleteMany({
    where: { id: params.id, OR: [{ student: { userId: user.id } }, { lesson: { userId: user.id } }] },
  });
  return { ok: true };
});
