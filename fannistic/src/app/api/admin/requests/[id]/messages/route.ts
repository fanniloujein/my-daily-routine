import { prisma } from "@/server/db";
import { guardAdmin } from "@/server/admin";
import { checkUpload, formFiles, MAX_FILES } from "@/server/files";
import { notifyMessage } from "@/server/requests";
import { error, json } from "@/server/security";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  if (!form) return error("bad_request", 400);
  const body = String(form.get("body") ?? "").trim();
  const uploads = formFiles(form);
  if ((!body && !uploads.length) || body.length > 5000 || uploads.length > MAX_FILES) return error("bad_request", 400);
  const checked = await Promise.all(uploads.map((f) => checkUpload(f)));
  const bad = checked.find((c) => !c.ok);
  if (bad) return error("bad_file", 400, { name: bad.name });
  const request = await prisma.projectRequest.findUnique({ where: { id }, select: { id: true } });
  if (!request) return error("not_found", 404);
  await prisma.message.create({
    data: {
      requestId: id,
      authorRole: "TEAM",
      body,
      files: { create: checked.flatMap((c) => (c.ok ? [{ kind: "CLIENT_ATTACHMENT" as const, originalName: c.name, mime: c.mime, size: c.size, data: c.data, requestId: id }] : [])) },
    },
  });
  const notify = form.get("notify") === "1";
  const emailSent = notify ? await notifyMessage(id, body || "(fichier joint)") : false;
  return json({ ok: true, emailSent }, 201);
}
