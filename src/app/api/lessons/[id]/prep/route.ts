import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route, searchParam } from "@/lib/api";

async function owned(userId: string, id: string) {
  return prisma.lesson.findFirstOrThrow({ where: { id, userId } });
}

/** Ajouter une étape à la checklist de préparation */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  await owned(user.id, params.id);
  const { label } = await body(req, z.object({ label: z.string().trim().min(1).max(200) }));
  const max = await prisma.prepItem.aggregate({ where: { lessonId: params.id }, _max: { order: true } });
  return prisma.prepItem.create({ data: { lessonId: params.id, label, order: (max._max.order ?? 0) + 1 } });
});

/** Cocher / décocher une étape */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  await owned(user.id, params.id);
  const { itemId, done } = await body(req, z.object({ itemId: z.string(), done: z.boolean() }));
  await prisma.prepItem.updateMany({ where: { id: itemId, lessonId: params.id }, data: { done } });
  // Si tout est coché, le créneau de préparation est marqué terminé
  const items = await prisma.prepItem.findMany({ where: { lessonId: params.id } });
  const allDone = items.length > 0 && items.every((i) => i.done);
  await prisma.activity.updateMany({
    where: { lessonId: params.id, lessonRole: "prep", recurrence: "NONE" },
    data: allDone ? { status: "DONE", completedAt: new Date() } : { status: "TODO", completedAt: null },
  });
  return { ok: true, allDone };
});

export const DELETE = route<{ id: string }>(async ({ req, user, params }) => {
  await owned(user.id, params.id);
  const itemId = searchParam(req, "itemId");
  if (itemId) await prisma.prepItem.deleteMany({ where: { id: itemId, lessonId: params.id } });
  return { ok: true };
});
