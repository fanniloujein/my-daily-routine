import { submissionSchema } from "@/lib/services/project";
import { checkUpload, formFiles, MAX_FILES } from "@/server/files";
import { clientIp, error, hashIp, json, rateLimit, sameOrigin } from "@/server/security";
import { createRequest } from "@/server/requests";
import { getSessionUser } from "@/server/auth";

const MIN_FILL_MS = 4000;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error("forbidden", 403);
  const ipHash = hashIp(clientIp(req));
  if (!(await rateLimit(`submit:${ipHash}`, 8, 60 * 60 * 1000))) return error("rate_limited", 429);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error("bad_request", 400);
  }

  // Champ piège rempli = robot : on répond comme si tout allait bien, sans rien enregistrer.
  if (String(form.get("website") ?? "")) return json({ ok: true, reference: "FAN-0000-000000", token: "", emailSent: false });

  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return error("bad_request", 400);
  }
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    const contact: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "contact" && issue.path[1]) contact[String(issue.path[1])] = issue.message || "invalid";
    }
    return Object.keys(contact).length ? error("validation", 400, { errors: { contact } }) : error("bad_request", 400);
  }
  if (Date.now() - parsed.data.startedAt < MIN_FILL_MS) return error("rate_limited", 429);

  const uploads = formFiles(form);
  if (uploads.length > MAX_FILES) return error("validation", 400, { errors: { files: [{ name: "", reason: "tooMany" }] } });
  const checked = await Promise.all(uploads.map((f) => checkUpload(f)));
  const rejected = checked.filter((c) => !c.ok);
  if (rejected.length) {
    return error("validation", 400, { errors: { files: rejected.map((r) => ({ name: r.name, reason: r.ok ? "" : r.reason })) } });
  }

  const user = await getSessionUser();
  const files = checked.flatMap((c) => (c.ok ? [{ name: c.name, mime: c.mime, size: c.size, data: c.data }] : []));
  const result = await createRequest(parsed.data, files, user, ipHash);
  if (!result.ok) {
    if (result.unavailable) return error("unavailable", 400, { services: result.unavailable });
    return error("validation", 400, { errors: result.errors });
  }
  return json({ ok: true, reference: result.reference, token: result.token, emailSent: result.emailSent }, 201);
}
