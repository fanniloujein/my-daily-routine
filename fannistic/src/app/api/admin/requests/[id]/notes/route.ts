import { z } from "zod";
import { prisma } from "@/server/db";
import { guardAdmin, readJson } from "@/server/admin";
import { error, json } from "@/server/security";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { id } = await params;
  const parsed = z.object({ body: z.string().trim().min(1).max(5000) }).safeParse(await readJson(req));
  if (!parsed.success) return error("bad_request", 400);
  const note = await prisma.internalNote.create({ data: { requestId: id, authorId: g.user.id, body: parsed.data.body } }).catch(() => null);
  if (!note) return error("not_found", 404);
  return json({ ok: true }, 201);
}
