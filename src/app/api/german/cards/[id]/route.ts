import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { flashcardSchema } from "@/lib/validation";

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  await prisma.flashcard.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  return prisma.flashcard.update({ where: { id: params.id }, data: await body(req, flashcardSchema.partial()) });
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.flashcard.deleteMany({ where: { id: params.id, userId: user.id } });
  return { ok: true };
});
