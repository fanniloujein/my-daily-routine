import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const d = await body(req, z.object({ done: z.boolean() }));
  await prisma.projectEvent.updateMany({ where: { id: params.id, project: { userId: user.id } }, data: d });
  return { ok: true };
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.projectEvent.deleteMany({ where: { id: params.id, project: { userId: user.id } } });
  return { ok: true };
});
