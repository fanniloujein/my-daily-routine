import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";

export const POST = route(async ({ req, user }) => {
  const { ids } = await body(req, z.object({ ids: z.array(z.string()).max(200) }));
  await prisma.$transaction(ids.map((id, order) => prisma.category.updateMany({ where: { id, userId: user.id }, data: { order } })));
  return { ok: true };
});
