import { prisma } from "@/server/db";
import { guardAdmin } from "@/server/admin";
import { checkUpload, formFiles } from "@/server/files";
import { error, json } from "@/server/security";

const MAX_DELIVERABLE = 50 * 1024 * 1024;

/** Dépôt des fichiers livrés au client (visibles dans son espace de suivi). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  if (!form) return error("bad_request", 400);
  const uploads = formFiles(form);
  if (!uploads.length || uploads.length > 10) return error("bad_request", 400);
  const checked = await Promise.all(uploads.map((f) => checkUpload(f, { maxSize: MAX_DELIVERABLE })));
  const bad = checked.find((c) => !c.ok);
  if (bad) return error("bad_file", 400, { name: bad.name });
  const request = await prisma.projectRequest.findUnique({ where: { id }, select: { id: true } });
  if (!request) return error("not_found", 404);
  await prisma.storedFile.createMany({
    data: checked.flatMap((c) => (c.ok ? [{ kind: "DELIVERABLE" as const, originalName: c.name, mime: c.mime, size: c.size, data: c.data, requestId: id }] : [])),
  });
  return json({ ok: true }, 201);
}
