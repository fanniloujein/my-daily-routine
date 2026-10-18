import { z } from "zod";
import { guardAdmin, readJson } from "@/server/admin";
import { companySchema, CONTENT_KEYS, pricingSchema, writeSetting } from "@/server/settings";
import { error, json } from "@/server/security";

const url = z.string().trim().max(300).refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "URL invalide (https://…)");
const companyInput = companySchema.extend({
  socials: z.object({ instagram: url, facebook: url, linkedin: url, behance: url, tiktok: url, whatsapp: url }),
});
const contentInput = z.record(z.enum(["fr", "en", "ar"]), z.record(z.enum(CONTENT_KEYS), z.string().trim().max(400)));

const SCHEMAS: Record<string, z.ZodTypeAny> = { pricing: pricingSchema, company: companyInput, content: contentInput };

export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { key } = await params;
  const schema = SCHEMAS[key];
  if (!schema) return error("not_found", 404);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return error("bad_request", 400, { message: i ? `${i.path.join(" › ")} : ${i.message}` : "Données invalides." });
  }
  await writeSetting(key, parsed.data);
  return json({ ok: true });
}
