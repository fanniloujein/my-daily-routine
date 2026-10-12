import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { mediaSchema } from "@/lib/validation";

export const GET = route(async ({ user }) => prisma.mediaItem.findMany({ where: { userId: user.id }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }));

export const POST = route(async ({ req, user }) => {
  const d = await body(req, mediaSchema);
  return prisma.mediaItem.create({ data: { ...d, userId: user.id } });
});
