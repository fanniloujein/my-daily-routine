import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getViewer, viewerCan } from "@/server/content";
import { storage } from "@/server/storage";

/**
 * Téléchargement protégé : l'abonnement est revérifié à CHAQUE requête.
 * Un abonnement expiré ne peut donc plus télécharger, même avec un ancien lien.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const resource = await prisma.educationalResource.findUnique({ where: { id } });
  if (!resource || !resource.fileId) return NextResponse.json({ error: "notFound" }, { status: 404 });
  const viewer = await getViewer(user);
  const isAuthor = resource.uploadedById === user.id;
  if (resource.status !== "PUBLISHED" && user.role !== "ADMIN" && !isAuthor) {
    return NextResponse.json({ error: "notFound" }, { status: 404 });
  }
  if (!viewerCan(viewer, resource.accessLevel, resource.uploadedById)) {
    return NextResponse.json({ error: "subscriptionRequired" }, { status: 403 });
  }

  const file = await storage.read(resource.fileId);
  if (!file) return NextResponse.json({ error: "notFound" }, { status: 404 });
  await prisma.educationalResource.update({ where: { id }, data: { downloadCount: { increment: 1 } } });

  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.bytes.byteLength),
      "Content-Disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
