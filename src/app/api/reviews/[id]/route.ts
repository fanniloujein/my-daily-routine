import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const { reflection } = await body(req, z.object({ reflection: z.string().max(5000) }));
  await prisma.weeklyReview.updateMany({ where: { id: params.id, userId: user.id }, data: { reflection } });
  return { ok: true };
});
