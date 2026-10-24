import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";

/** Vérifie que les membres d'un groupe sont bien des élèves (pas des groupes) de l'utilisatrice. */
export async function checkMembers(userId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const found = await prisma.student.findMany({ where: { id: { in: unique }, userId, isGroup: false }, select: { id: true } });
  if (found.length !== unique.length) throw new HttpError(400, "Un des élèves du groupe est introuvable.");
  return found;
}

export function assertGroupSize(isGroup: boolean, count: number) {
  if (isGroup && count < 2) throw new HttpError(400, "Un groupe doit contenir au moins 2 élèves.");
}
