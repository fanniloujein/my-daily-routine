import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/auth";
import { checkUpload, formFiles, MAX_FILES } from "@/server/files";
import { findAccessibleRequest } from "@/server/requests";
import { clientIp, error, hashIp, json, rateLimit, sameOrigin } from "@/server/security";
import { isMailConfigured, sendMail, siteUrl } from "@/server/mail";

export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  if (!sameOrigin(req)) return error("forbidden", 403);
  const { reference } = await params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error("bad_request", 400);
  }
  const user = await getSessionUser();
  const request = await findAccessibleRequest(reference, String(form.get("t") ?? ""), user);
  if (!request) return error("not_found", 404);
  if (!(await rateLimit(`msg:${hashIp(clientIp(req))}`, 30, 60 * 60 * 1000))) return error("rate_limited", 429);

  const body = String(form.get("body") ?? "").trim();
  const uploads = formFiles(form);
  if (!body && !uploads.length) return error("empty", 400);
  if (body.length > 5000) return error("too_long", 400);
  if (uploads.length > MAX_FILES) return error("too_many_files", 400);
  const checked = await Promise.all(uploads.map((f) => checkUpload(f)));
  const bad = checked.find((c) => !c.ok);
  if (bad) return error("bad_file", 400, { name: bad.name, reason: bad.ok ? "" : bad.reason });

  // Un membre de l'équipe connecté écrit au nom de l'équipe.
  const authorRole = user?.role === "ADMIN" ? "TEAM" : "CLIENT";
  const message = await prisma.message.create({
    data: {
      requestId: request.id,
      authorRole,
      body,
      files: {
        create: checked.flatMap((c) =>
          c.ok ? [{ kind: "CLIENT_ATTACHMENT" as const, originalName: c.name, mime: c.mime, size: c.size, data: c.data, requestId: request.id }] : [],
        ),
      },
    },
  });

  const notify = process.env.ADMIN_NOTIFY_EMAIL;
  if (authorRole === "CLIENT" && notify && isMailConfigured()) {
    await sendMail({
      to: notify,
      replyTo: request.email,
      subject: `Nouveau message client — ${request.reference}`,
      text: `${request.name} a écrit :\n\n${body || "(fichiers joints uniquement)"}`,
      link: { url: `${siteUrl()}/admin/demandes/${request.reference}`, label: "Ouvrir la demande" },
    });
  }
  return json({ ok: true, id: message.id }, 201);
}
