import { prisma } from "@/server/db";
import { guardAdmin, readJson } from "@/server/admin";
import { error, json } from "@/server/security";
import { faqSchema } from "../schema";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { id } = await params;
  const parsed = faqSchema.safeParse(await readJson(req));
  if (!parsed.success) return error("bad_request", 400, { message: "La question et la réponse en français sont obligatoires." });
  const r = await prisma.faqItem.updateMany({ where: { id }, data: parsed.data });
  if (!r.count) return error("not_found", 404);
  return json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { id } = await params;
  await prisma.faqItem.deleteMany({ where: { id } });
  return json({ ok: true });
}
