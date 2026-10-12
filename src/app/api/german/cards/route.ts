import { prisma } from "@/lib/db";
import { body, route, searchParam } from "@/lib/api";
import { flashcardSchema } from "@/lib/validation";
import { today } from "@/lib/dates";

export const GET = route(async ({ req, user }) => {
  const due = searchParam(req, "due") === "1";
  return prisma.flashcard.findMany({
    where: { userId: user.id, ...(due ? { dueDate: { lte: today() } } : {}) },
    orderBy: due ? [{ dueDate: "asc" }, { ease: "asc" }] : [{ createdAt: "desc" }],
    take: due ? 50 : 500,
  });
});

export const POST = route(async ({ req, user }) => {
  const d = await body(req, flashcardSchema);
  return prisma.flashcard.create({ data: { ...d, userId: user.id, dueDate: today() } });
});
