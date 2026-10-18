import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { guardAdmin, readJson } from "@/server/admin";
import { error, json } from "@/server/security";
import { normalize, projectSchema } from "../schema";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { id } = await params;
  const parsed = projectSchema.safeParse(await readJson(req));
  if (!parsed.success) return error("bad_request", 400, { message: parsed.error.issues[0]?.message });
  const before = await prisma.portfolioProject.findUnique({ where: { id } });
  if (!before) return error("not_found", 404);
  try {
    const { results, ...rest } = normalize(parsed.data);
    await prisma.portfolioProject.update({ where: { id }, data: { ...rest, results: results ?? Prisma.DbNull } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return error("exists", 409, { message: "Cet identifiant d’URL est déjà utilisé." });
    throw e;
  }
  // Supprime les images retirées du projet.
  const removed = before.imageIds.filter((x) => !parsed.data.imageIds.includes(x));
  if (removed.length) await prisma.storedFile.deleteMany({ where: { id: { in: removed }, kind: "PORTFOLIO_IMAGE" } });
  return json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { id } = await params;
  const p = await prisma.portfolioProject.findUnique({ where: { id } });
  if (p) {
    await prisma.$transaction([
      prisma.storedFile.deleteMany({ where: { id: { in: p.imageIds }, kind: "PORTFOLIO_IMAGE" } }),
      prisma.portfolioProject.delete({ where: { id } }),
    ]);
  }
  return json({ ok: true });
}
