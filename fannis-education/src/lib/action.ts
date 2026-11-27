import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

export type ActionFailure = { ok: false; error: string; fieldErrors?: Record<string, string> };
export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | ActionFailure;

/** Erreur métier dont le code est traduit côté client (dictionnaire `errors`). */
export class AppError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export function zodFail(error: z.ZodError): ActionFailure {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: "validation", fieldErrors };
}

/** Exécute une action serveur et convertit les erreurs métier en résultat sérialisable. */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e); // laisse passer redirect() / notFound()
    if (e instanceof AppError) return { ok: false, error: e.code };
    console.error("[action]", e);
    return { ok: false, error: "generic" };
  }
}
