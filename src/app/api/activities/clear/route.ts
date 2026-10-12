import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { today } from "@/lib/dates";

/**
 * Remise à zéro des activités (avec confirmation côté interface) :
 * - "done"   : activités terminées et passées uniquement
 * - "future" : activités à venir (à partir d'aujourd'hui), récurrences comprises
 * - "all"    : toutes les activités (les élèves, projets, cartes, médicaments… sont conservés)
 */
export const POST = route(async ({ req, user }) => {
  const { scope } = await body(req, z.object({ scope: z.enum(["done", "future", "all"]) }));
  const t = today();
  const where =
    scope === "all"
      ? { userId: user.id }
      : scope === "done"
        ? { userId: user.id, OR: [{ status: "DONE" as const }, { recurrence: "NONE" as const, date: { lt: t } }] }
        : { userId: user.id, OR: [{ date: { gte: t } }, { recurrence: { not: "NONE" as const } }] };
  const r = await prisma.activity.deleteMany({ where });
  return { ok: true, count: r.count };
});
