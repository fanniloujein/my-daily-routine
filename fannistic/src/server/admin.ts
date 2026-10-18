import "server-only";
import { requireRole, type SessionUser } from "./auth";
import { error, sameOrigin } from "./security";

/** Contrôle d'accès des routes d'administration (rôle revérifié en base + origine). */
export async function guardAdmin(req: Request): Promise<{ user: SessionUser; res?: never } | { user?: never; res: Response }> {
  if (req.method !== "GET" && !sameOrigin(req)) return { res: error("forbidden", 403) };
  const user = await requireRole("ADMIN");
  if (!user) return { res: error("unauthorized", 401) };
  return { user };
}

export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}
