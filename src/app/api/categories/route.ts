import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { categorySchema } from "@/lib/validation";
import { ensureDefaultCategories } from "@/server/categories";

export const GET = route(async ({ user }) => {
  await ensureDefaultCategories(user.id);
  const cats = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { order: "asc" },
    include: { _count: { select: { activities: true } } },
  });
  return cats.map(({ _count, ...c }) => ({ ...c, activityCount: _count.activities }));
});

export const POST = route(async ({ req, user }) => {
  const data = await body(req, categorySchema);
  const max = await prisma.category.aggregate({ where: { userId: user.id }, _max: { order: true } });
  return prisma.category.create({ data: { ...data, reminderMinutes: data.reminderMinutes ?? null, userId: user.id, order: (max._max.order ?? 0) + 1 } });
});
