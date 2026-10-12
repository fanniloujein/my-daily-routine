import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { review } from "@/lib/srs";
import { today } from "@/lib/dates";

/** Enregistre une révision (répétition espacée) et calcule la prochaine échéance. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const card = await prisma.flashcard.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  const { grade } = await body(req, z.object({ grade: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]) }));
  const next = review(card, grade, today());
  const [updated] = await prisma.$transaction([
    prisma.flashcard.update({ where: { id: card.id }, data: { ...next, lastReview: new Date() } }),
    prisma.flashcardReview.create({ data: { flashcardId: card.id, grade } }),
  ]);
  return updated;
});
