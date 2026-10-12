import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { body, route } from "@/lib/api";

/**
 * « Tout vider » : supprime tout le contenu (activités, élèves, séances, projets, allemand,
 * médicaments, sport, loisirs, énergie, bilans). Conserve le compte, les catégories et les réglages.
 * Exige de recopier le mot « VIDER » pour éviter toute suppression accidentelle.
 */
export const POST = route(async ({ req, user }) => {
  const { confirm } = await body(req, z.object({ confirm: z.string() }));
  if (confirm.trim().toUpperCase() !== "VIDER") throw new HttpError(400, "Tape VIDER pour confirmer.");
  const userId = user.id;
  await prisma.$transaction([
    prisma.activity.deleteMany({ where: { userId } }),
    prisma.lesson.deleteMany({ where: { userId } }),
    prisma.student.deleteMany({ where: { userId } }),
    prisma.project.deleteMany({ where: { userId } }),
    prisma.germanSession.deleteMany({ where: { userId } }),
    prisma.flashcard.deleteMany({ where: { userId } }),
    prisma.medication.deleteMany({ where: { userId } }),
    prisma.sportSession.deleteMany({ where: { userId } }),
    prisma.sportProfile.deleteMany({ where: { userId } }),
    prisma.mediaItem.deleteMany({ where: { userId } }),
    prisma.leisureIdea.deleteMany({ where: { userId } }),
    prisma.energyCheckin.deleteMany({ where: { userId } }),
    prisma.weeklyReview.deleteMany({ where: { userId } }),
  ]);
  return { ok: true };
});
