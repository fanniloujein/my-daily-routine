import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import { Prisma, type User } from "@prisma/client";
import { HttpError, requireUser } from "./auth";

type Ctx<P> = { params: Promise<P> };

/** Enveloppe commune des routes API : authentification, erreurs, JSON. */
export function route<P = Record<string, string>>(fn: (args: { req: Request; user: User; params: P }) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await requireUser();
      const params = ctx?.params ? await ctx.params : ({} as P);
      const result = await fn({ req, user, params });
      if (result instanceof Response) return result;
      return NextResponse.json(serialize(result === undefined ? { ok: true } : result));
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Convertit les Decimal Prisma en nombres et retire les binaires. */
export function serialize(v: unknown): unknown {
  if (v == null) return v;
  if (Prisma.Decimal.isDecimal(v)) return Number((v as Prisma.Decimal).toString());
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array || Buffer.isBuffer(v)) return undefined;
  if (Array.isArray(v)) return v.map(serialize);
  if (v instanceof Map) return Object.fromEntries([...v.entries()].map(([k, x]) => [k, serialize(x)]));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = serialize(x);
    return out;
  }
  return v;
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) {
    const first = e.issues[0];
    return NextResponse.json({ error: first?.message || "Formulaire invalide", field: first?.path?.join("."), issues: e.issues }, { status: 400 });
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025") return NextResponse.json({ error: "Élément introuvable." }, { status: 404 });
    if (e.code === "P2002") return NextResponse.json({ error: "Cet élément existe déjà (doublon refusé)." }, { status: 409 });
    if (e.code === "P2003") return NextResponse.json({ error: "Impossible : cet élément est utilisé ailleurs (historique financier ou lien)." }, { status: 409 });
    if (e.code.startsWith("P1")) return NextResponse.json({ error: "Base de données inaccessible. Réessayez dans un instant." }, { status: 503 });
  }
  if (e instanceof Prisma.PrismaClientInitializationError) return NextResponse.json({ error: "Base de données inaccessible. Réessayez dans un instant." }, { status: 503 });
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  console.error(`[erreur ${ref}]`, e);
  return NextResponse.json({ error: `Erreur inattendue (réf. ${ref}).` }, { status: 500 });
}

export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Requête invalide.");
  }
  return schema.parse(json);
}

export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

export const qs = (req: Request) => new URL(req.url).searchParams;
