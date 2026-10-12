import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { mediaSchema } from "@/lib/validation";

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  await prisma.mediaItem.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  return prisma.mediaItem.update({ where: { id: params.id }, data: await body(req, mediaSchema.partial()) });
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.mediaItem.deleteMany({ where: { id: params.id, userId: user.id } });
  return { ok: true };
});
