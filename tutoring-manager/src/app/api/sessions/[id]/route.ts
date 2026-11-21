import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { route, body, fail, qs, serialize } from "@/lib/api";
import { sessionPatchSchema, sessionSchema } from "@/lib/validation";
import { ConflictError, deleteSessions, patchSession, updateSession } from "@/server/sessions";
import { sessionInclude } from "@/server/schedule";

type P = { id: string };

const conflict = async <T,>(fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json(serialize({ error: e.message, conflicts: e.conflicts }), { status: 409 });
    throw e;
  }
};

export const GET = route<P>(async ({ params }) => {
  const s = await prisma.session.findUnique({ where: { id: params.id }, include: sessionInclude });
  return s ?? fail(404, "Séance introuvable.");
});

export const PUT = route<P>(async ({ req, params }) => {
  const v = await body(req, sessionSchema);
  return conflict(() => updateSession(params.id, v));
});

export const PATCH = route<P>(async ({ req, params }) => {
  const v = await body(req, sessionPatchSchema);
  return conflict(() => patchSession(params.id, v));
});

// ?scope=following : supprime aussi les séances suivantes (prévues) de la même série
export const DELETE = route<P>(async ({ req, params }) => {
  const s = await prisma.session.findUnique({ where: { id: params.id } });
  if (!s) fail(404, "Séance introuvable.");
  let ids = [params.id];
  if (qs(req).get("scope") === "following" && s!.seriesId) {
    ids = (await prisma.session.findMany({ where: { seriesId: s!.seriesId, date: { gte: s!.date }, status: "PLANNED" }, select: { id: true } })).map((x) => x.id);
    if (!ids.includes(params.id)) ids.push(params.id);
  }
  return deleteSessions(ids);
});
