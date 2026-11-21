import type { Prisma, SessionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { route, body, qs, serialize } from "@/lib/api";
import { sessionSchema } from "@/lib/validation";
import { createSessions, ConflictError } from "@/server/sessions";
import { sessionInclude } from "@/server/schedule";

export const GET = route(async ({ req }) => {
  const p = qs(req);
  const q = p.get("q")?.trim();
  const statuses = p.get("status")?.split(",").filter(Boolean) as SessionStatus[] | undefined;
  const where: Prisma.SessionWhereInput = {
    date: { gte: p.get("from") ?? undefined, lte: p.get("to") ?? undefined },
    ...(statuses?.length ? { status: { in: statuses } } : {}),
    ...(p.get("studentId") ? { participants: { some: { studentId: p.get("studentId")! } } } : {}),
    ...(p.get("subjectId") ? { subjectId: p.get("subjectId") } : {}),
    ...(p.get("levelId") ? { levelId: p.get("levelId") } : {}),
    ...(p.get("unprepared") === "1" ? { prepared: false, status: "PLANNED" } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { chapter: { contains: q, mode: "insensitive" } },
            { participants: { some: { student: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } } } },
          ],
        }
      : {}),
  };
  const take = Math.min(Number(p.get("take") ?? 500), 1000);
  const skip = Number(p.get("skip") ?? 0);
  const order = p.get("order") === "desc" ? "desc" : "asc";
  const [items, total] = await Promise.all([
    prisma.session.findMany({ where, include: sessionInclude, orderBy: [{ date: order }, { startTime: order }], take, skip }),
    prisma.session.count({ where }),
  ]);
  return { items, total };
});

export const POST = route(async ({ req }) => {
  try {
    return await createSessions(await body(req, sessionSchema));
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json(serialize({ error: e.message, conflicts: e.conflicts }), { status: 409 });
    throw e;
  }
});
