import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";

export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const v = await body(req, z.object({ read: z.boolean().optional(), dismissed: z.boolean().optional() }));
  return prisma.notification.update({
    where: { id: params.id },
    data: { ...(v.read !== undefined ? { readAt: v.read ? new Date() : null } : {}), ...(v.dismissed !== undefined ? { dismissed: v.dismissed } : {}) },
  });
});
