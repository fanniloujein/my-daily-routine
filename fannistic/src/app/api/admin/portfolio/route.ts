import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { guardAdmin, readJson } from "@/server/admin";
import { error, json } from "@/server/security";
import { normalize, projectSchema } from "./schema";

export async function POST(req: Request) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const parsed = projectSchema.safeParse(await readJson(req));
  if (!parsed.success) return error("bad_request", 400, { message: parsed.error.issues[0]?.message });
  try {
    const { results, ...rest } = normalize(parsed.data);
    const p = await prisma.portfolioProject.create({ data: { ...rest, results: results ?? Prisma.DbNull } });
    return json({ ok: true, id: p.id }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return error("exists", 409, { message: "Cet identifiant d’URL est déjà utilisé." });
    throw e;
  }
}
