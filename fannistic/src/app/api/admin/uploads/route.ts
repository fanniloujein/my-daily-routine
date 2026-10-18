import { prisma } from "@/server/db";
import { guardAdmin } from "@/server/admin";
import { checkUpload, formFiles, MAX_IMAGE_SIZE } from "@/server/files";
import { error, json } from "@/server/security";

/** Envoi d'une image de portfolio (PNG, JPEG, WebP ou GIF, 5 Mo max). */
export async function POST(req: Request) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const form = await req.formData().catch(() => null);
  const file = form ? formFiles(form, "file")[0] : undefined;
  if (!file) return error("bad_request", 400);
  const c = await checkUpload(file, { imagesOnly: true, maxSize: MAX_IMAGE_SIZE });
  if (!c.ok) return error("bad_file", 400, { message: c.reason === "tooBig" ? "Image trop lourde (5 Mo max)." : "Format accepté : PNG, JPEG, WebP ou GIF." });
  const saved = await prisma.storedFile.create({ data: { kind: "PORTFOLIO_IMAGE", originalName: c.name, mime: c.mime, size: c.size, data: c.data }, select: { id: true } });
  return json({ ok: true, id: saved.id }, 201);
}
