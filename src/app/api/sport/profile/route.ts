import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { sportProfileSchema } from "@/lib/validation";

export const GET = route(async ({ user }) => prisma.sportProfile.findUnique({ where: { userId: user.id } }));

export const PUT = route(async ({ req, user }) => {
  const d = await body(req, sportProfileSchema);
  return prisma.sportProfile.upsert({ where: { userId: user.id }, create: { ...d, userId: user.id }, update: d });
});
