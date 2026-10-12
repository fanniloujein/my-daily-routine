import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { leisureSchema } from "@/lib/validation";

export const GET = route(async ({ user }) => prisma.leisureIdea.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }));

export const POST = route(async ({ req, user }) => prisma.leisureIdea.create({ data: { ...(await body(req, leisureSchema)), userId: user.id } }));
