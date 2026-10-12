import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { dateStr } from "@/lib/validation";
import { getActivityOwned } from "@/server/occurrences";

export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const { date } = await body(req, z.object({ date: dateStr.optional() }));
  const a = await getActivityOwned(user.id, params.id);
  const { id: _id, createdAt: _c, updatedAt: _u, completedAt: _d, ...rest } = a;
  void _id; void _c; void _u; void _d;
  return prisma.activity.create({
    data: { ...rest, title: `${a.title} (copie)`, date: date ?? a.date, status: "TODO", postponeCount: 0, isDemo: false, lessonId: null, lessonRole: null, germanSessionId: null, sportSessionId: null },
  });
});
