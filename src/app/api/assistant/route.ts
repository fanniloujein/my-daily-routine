import { z } from "zod";
import { body, route } from "@/lib/api";
import { interpret } from "@/server/assistant";

const schema = z.object({
  message: z.string().trim().min(1, "Message vide").max(1000),
  lastActivityId: z.string().nullish(),
  lastActivityDate: z.string().nullish(),
});

/** Analyse une phrase et renvoie des actions PROPOSÉES (rien n'est exécuté ici). */
export const POST = route(async ({ req, user }) => {
  const d = await body(req, schema);
  return interpret(user, d.message, { lastActivityId: d.lastActivityId, lastActivityDate: d.lastActivityDate });
});
