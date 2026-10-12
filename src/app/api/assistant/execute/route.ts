import { z } from "zod";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { executeAction } from "@/server/assistant";
import { DESTRUCTIVE, type AssistantAction } from "@/lib/nlp";

const schema = z.object({ action: z.object({ type: z.string(), data: z.record(z.unknown()) }), confirmed: z.boolean() });

/** Exécute une action après confirmation explicite de l'utilisatrice. */
export const POST = route(async ({ req, user }) => {
  const d = await body(req, schema);
  if (!d.confirmed) throw new HttpError(400, "Confirmation requise");
  const action = d.action as unknown as AssistantAction;
  if (DESTRUCTIVE.includes(action.type) && !d.confirmed) throw new HttpError(400, "Confirmation requise");
  return executeAction(user, action);
});
