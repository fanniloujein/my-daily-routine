import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { guardAdmin, readJson } from "@/server/admin";
import { getServices } from "@/server/catalog";
import { error, json } from "@/server/security";

export async function POST(req: Request) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const parsed = z
    .object({ slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,58}$/), name: z.string().trim().min(1).max(120) })
    .safeParse(await readJson(req));
  if (!parsed.success) return error("bad_request", 400, { message: "Identifiant : lettres minuscules, chiffres et tirets." });
  const existing = await getServices();
  try {
    await prisma.service.create({
      data: {
        slug: parsed.data.slug,
        icon: "sparkles",
        active: false,
        order: existing.length + 1,
        name: { fr: parsed.data.name, en: "", ar: "" },
        description: { fr: "", en: "", ar: "" },
        questions: [],
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return error("exists", 409);
    throw e;
  }
  return json({ ok: true, slug: parsed.data.slug }, 201);
}
