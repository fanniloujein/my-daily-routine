import { prisma } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/constants";

export async function ensureDefaultCategories(userId: string) {
  const count = await prisma.category.count({ where: { userId } });
  if (count > 0) return;
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c, i) => ({ ...c, reminderMinutes: c.reminderMinutes ?? null, userId, order: i })),
  });
}

/** Catégorie correspondant à une clé système ; recrée la catégorie si elle a été supprimée. */
export async function categoryForKind(userId: string, kind: string) {
  const found = await prisma.category.findFirst({ where: { userId, kind }, orderBy: { order: "asc" } });
  if (found) return found;
  const def = DEFAULT_CATEGORIES.find((c) => c.kind === kind) ?? DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];
  const max = await prisma.category.aggregate({ where: { userId }, _max: { order: true } });
  return prisma.category.create({
    data: { ...def, reminderMinutes: def.reminderMinutes ?? null, userId, order: (max._max.order ?? 0) + 1 },
  });
}
