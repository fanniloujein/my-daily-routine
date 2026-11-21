import { z } from "zod";
import { route, body } from "@/lib/api";
import { dateStr, timeStr } from "@/lib/validation";
import { conflictsFor } from "@/server/schedule";

// Vérification en direct des conflits pendant la saisie d'une séance
const schema = z.object({ excludeId: z.string().optional(), slots: z.array(z.object({ date: dateStr(), startTime: timeStr(), endTime: timeStr() })).max(200) });

export const POST = route(async ({ req }) => {
  const v = await body(req, schema);
  const found = await conflictsFor(v.slots, undefined, v.excludeId ? [v.excludeId] : []);
  return found.map((f) => ({ ...f.slot, with: f.conflicts.map((c) => c.label) }));
});
