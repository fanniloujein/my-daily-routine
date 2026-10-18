import { prisma } from "@/server/db";
import { guardAdmin, readJson } from "@/server/admin";
import { error, json } from "@/server/security";
import { faqSchema } from "./schema";

export async function POST(req: Request) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const parsed = faqSchema.safeParse(await readJson(req));
  if (!parsed.success) return error("bad_request", 400, { message: "La question et la réponse en français sont obligatoires." });
  const f = await prisma.faqItem.create({ data: parsed.data });
  return json({ ok: true, id: f.id }, 201);
}
