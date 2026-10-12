import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import { Prisma, type User } from "@prisma/client";
import { HttpError, requireUser } from "./auth";

type Ctx<P> = { params: Promise<P> };

/** Enveloppe commune : authentification, gestion d'erreurs et réponses JSON. */
export function route<P = Record<string, string>>(
  fn: (args: { req: Request; user: User; params: P }) => Promise<unknown>,
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await requireUser();
      const params = ctx?.params ? await ctx.params : ({} as P);
      const result = await fn({ req, user, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result === undefined ? { ok: true } : result);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) {
    const first = e.issues[0];
    return NextResponse.json(
      { error: `Champ invalide${first?.path?.length ? ` (${first.path.join(".")})` : ""} : ${first?.message ?? ""}`, issues: e.issues },
      { status: 400 },
    );
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
    return NextResponse.json({ error: "Élément introuvable" }, { status: 404 });
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")) {
    return NextResponse.json(
      { error: "La base de données n'est pas à jour (tables manquantes). Redéploie l'application : « npm start » applique les migrations automatiquement. Diagnostic : /api/health" },
      { status: 503 },
    );
  }
  if (e instanceof Prisma.PrismaClientInitializationError || (e instanceof Prisma.PrismaClientKnownRequestError && e.code.startsWith("P1"))) {
    return NextResponse.json({ error: "Base de données inaccessible pour le moment. Réessaie dans un instant. Diagnostic : /api/health" }, { status: 503 });
  }
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  console.error(`[erreur ${ref}]`, e);
  return NextResponse.json({ error: `Une erreur inattendue est survenue (réf. ${ref}). Réessaie dans un instant ; si cela persiste, cherche « ${ref} » dans les Logs.` }, { status: 500 });
}

export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Corps de requête JSON invalide");
  }
  return schema.parse(json);
}

export function notFound(what = "Élément"): never {
  throw new HttpError(404, `${what} introuvable`);
}

export function searchParam(req: Request, key: string) {
  return new URL(req.url).searchParams.get(key);
}
