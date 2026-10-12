import { z } from "zod";
import { body, route } from "@/lib/api";
import { dateStr } from "@/lib/validation";
import { buildPlan } from "@/server/planning";

const schema = z.object({ date: dateStr, energy: z.number().int().min(1).max(5).optional(), light: z.boolean().optional() });

/** Génère une proposition de planning (rien n'est enregistré). */
export const POST = route(async ({ req, user }) => {
  const d = await body(req, schema);
  return buildPlan(user, d.date, { energy: d.energy, light: d.light });
});
