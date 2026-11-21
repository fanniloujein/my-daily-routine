import { z } from "zod";
import { route, body } from "@/lib/api";
import { deleteSessions, patchSession } from "@/server/sessions";

const schema = z.object({
  ids: z.array(z.string()).min(1).max(200),
  action: z.enum(["status", "delete", "prepared"]),
  status: z.enum(["PLANNED", "DONE", "CANCELLED", "POSTPONED", "STUDENT_ABSENT", "TEACHER_ABSENT"]).optional(),
});

export const POST = route(async ({ req }) => {
  const v = await body(req, schema);
  if (v.action === "delete") return deleteSessions(v.ids);
  for (const id of v.ids) await patchSession(id, v.action === "prepared" ? { prepared: true } : { status: v.status, force: true });
  return { updated: v.ids.length };
});
