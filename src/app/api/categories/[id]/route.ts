import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { body, route, searchParam } from "@/lib/api";
import { categorySchema } from "@/lib/validation";

async function owned(userId: string, id: string) {
  const c = await prisma.category.findFirst({ where: { id, userId } });
  if (!c) throw new HttpError(404, "Catégorie introuvable");
  return c;
}

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  await owned(user.id, params.id);
  const data = await body(req, categorySchema.partial());
  return prisma.category.update({ where: { id: params.id }, data });
});

/** Suppression : les activités sont réaffectées à une autre catégorie (jamais perdues). */
export const DELETE = route<{ id: string }>(async ({ req, user, params }) => {
  await owned(user.id, params.id);
  const count = await prisma.activity.count({ where: { categoryId: params.id } });
  const reassignTo = searchParam(req, "reassignTo");
  if (count > 0) {
    if (!reassignTo) throw new HttpError(409, `Cette catégorie contient ${count} activité(s). Choisis une catégorie de remplacement.`);
    if (reassignTo === params.id) throw new HttpError(400, "Choisis une autre catégorie.");
    await owned(user.id, reassignTo);
    await prisma.activity.updateMany({ where: { categoryId: params.id }, data: { categoryId: reassignTo } });
  }
  await prisma.category.delete({ where: { id: params.id } });
  return { ok: true, reassigned: count };
});
