import { prisma } from "@/server/db";
import { guardAdmin } from "@/server/admin";
import { json } from "@/server/security";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { id } = await params;
  const file = await prisma.storedFile.findUnique({ where: { id }, select: { kind: true } });
  if (file) {
    await prisma.storedFile.delete({ where: { id } });
    if (file.kind === "PORTFOLIO_IMAGE") {
      // Retire l'image des projets qui la référencent.
      const projects = await prisma.portfolioProject.findMany({ where: { imageIds: { has: id } } });
      for (const p of projects) await prisma.portfolioProject.update({ where: { id: p.id }, data: { imageIds: p.imageIds.filter((x) => x !== id) } });
    }
  }
  return json({ ok: true });
}
