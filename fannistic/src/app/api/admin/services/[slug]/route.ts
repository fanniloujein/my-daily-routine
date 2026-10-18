import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { guardAdmin, readJson } from "@/server/admin";
import { error, json } from "@/server/security";
import { firstIssue, serviceSchema } from "@/lib/services/schema";

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { slug } = await params;
  const raw = (await readJson(req)) as Record<string, unknown> | null;
  const parsed = serviceSchema.safeParse({ ...(raw ?? {}), slug });
  if (!parsed.success) return error("bad_request", 400, { message: firstIssue(parsed.error) });
  const s = parsed.data;
  // Les champs facultatifs vides sont retirés pour garder une configuration propre.
  const questions = s.questions.map((q) => ({
    ...q,
    help: q.help && (q.help.fr || q.help.en || q.help.ar) ? q.help : undefined,
    placeholder: q.placeholder && (q.placeholder.fr || q.placeholder.en || q.placeholder.ar) ? q.placeholder : undefined,
    options: ["single", "multi", "select"].includes(q.type) ? q.options : undefined,
    showIf: q.showIf ?? undefined,
  }));
  const r = await prisma.service.updateMany({
    where: { slug },
    data: {
      icon: s.icon,
      active: s.active,
      order: s.order,
      name: s.name,
      description: s.description,
      baseMin: s.baseMin,
      baseMax: s.baseMax,
      questions: JSON.parse(JSON.stringify(questions)) as Prisma.InputJsonValue,
    },
  });
  if (!r.count) return error("not_found", 404);
  return json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { slug } = await params;
  // Les demandes existantes conservent un instantané lisible de leurs réponses.
  await prisma.service.deleteMany({ where: { slug } });
  return json({ ok: true });
}
