import { z } from "zod";
import { body, route } from "@/lib/api";
import { dateStr, timeStr } from "@/lib/validation";
import { applyPlan } from "@/server/planning";

const block = z.object({
  key: z.string(),
  kind: z.enum(["fixed", "task", "break", "rest", "meal", "suggestion"]),
  title: z.string(),
  startTime: timeStr,
  endTime: timeStr,
  refId: z.string().optional(),
  occurrenceDate: dateStr.optional(),
  part: z.object({ index: z.number(), total: z.number() }).optional(),
  categoryKind: z.string().nullish(),
  suggestion: z.enum(["german", "sport"]).optional(),
});

const schema = z.object({
  date: dateStr,
  blocks: z.array(block).max(200),
  postponed: z.array(z.object({ id: z.string(), occurrenceDate: dateStr })).max(200),
  unplaced: z.array(z.string()).max(200).default([]),
});

/** Applique la proposition validée (et éventuellement ajustée) par l'utilisatrice. */
export const POST = route(async ({ req, user }) => {
  const d = await body(req, schema);
  return applyPlan(user, d.date, d.blocks, d.postponed, d.unplaced);
});
