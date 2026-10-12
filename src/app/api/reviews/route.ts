import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { dateStr } from "@/lib/validation";
import { generateWeeklyReview } from "@/server/stats";

export const GET = route(async ({ user }) => prisma.weeklyReview.findMany({ where: { userId: user.id }, orderBy: { weekStart: "desc" }, take: 26 }));

/** Génère (ou régénère) le bilan d'une semaine. */
export const POST = route(async ({ req, user }) => {
  const { weekStart } = await body(req, z.object({ weekStart: dateStr }));
  return generateWeeklyReview(user.id, weekStart);
});
