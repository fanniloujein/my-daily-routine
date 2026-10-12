import { z } from "zod";
import { prisma } from "@/lib/db";
import { decryptOpt, encrypt, encryptOpt } from "@/lib/crypto";
import { HttpError } from "@/lib/auth";

export const BACKUP_VERSION = 1;

/** Export complet des données de l'utilisatrice (JSON). Les données de santé sont incluses seulement sur demande. */
export async function exportData(userId: string, includeHealth: boolean) {
  const [user, categories, activities, energy, students, lessons, projects, germanSessions, flashcards, medications, sportProfile, sportSessions, media, leisure, reviews] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, locale: true, settings: true } }),
      prisma.category.findMany({ where: { userId } }),
      prisma.activity.findMany({ where: { userId }, include: { exceptions: true } }),
      prisma.energyCheckin.findMany({ where: { userId } }),
      prisma.student.findMany({ where: { userId }, include: { resources: true } }),
      prisma.lesson.findMany({ where: { userId }, include: { prepItems: true, resources: true } }),
      prisma.project.findMany({ where: { userId }, include: { tasks: true, events: true } }),
      prisma.germanSession.findMany({ where: { userId } }),
      prisma.flashcard.findMany({ where: { userId } }),
      includeHealth ? prisma.medication.findMany({ where: { userId }, include: { logs: true } }) : Promise.resolve([]),
      prisma.sportProfile.findUnique({ where: { userId } }),
      prisma.sportSession.findMany({ where: { userId } }),
      prisma.mediaItem.findMany({ where: { userId } }),
      prisma.leisureIdea.findMany({ where: { userId } }),
      prisma.weeklyReview.findMany({ where: { userId } }),
    ]);
  return {
    app: "my-life-os",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    includesHealth: includeHealth,
    user,
    categories,
    activities,
    energy,
    students,
    lessons,
    projects,
    germanSessions,
    flashcards,
    medications: medications.map(({ nameEnc, dosageEnc, instructionsEnc, ...m }) => ({
      ...m,
      name: decryptOpt(nameEnc),
      dosage: decryptOpt(dosageEnc),
      instructions: decryptOpt(instructionsEnc),
    })),
    sportProfile,
    sportSessions,
    media,
    leisure,
    reviews,
  };
}

const backupSchema = z.object({
  app: z.literal("my-life-os"),
  version: z.number().max(BACKUP_VERSION),
  categories: z.array(z.any()),
  activities: z.array(z.any()),
  energy: z.array(z.any()).default([]),
  students: z.array(z.any()).default([]),
  lessons: z.array(z.any()).default([]),
  projects: z.array(z.any()).default([]),
  germanSessions: z.array(z.any()).default([]),
  flashcards: z.array(z.any()).default([]),
  medications: z.array(z.any()).default([]),
  sportProfile: z.any().nullable().default(null),
  sportSessions: z.array(z.any()).default([]),
  media: z.array(z.any()).default([]),
  leisure: z.array(z.any()).default([]),
  reviews: z.array(z.any()).default([]),
  includesHealth: z.boolean().default(false),
  user: z.object({ settings: z.any().optional() }).partial().optional(),
});

type Row = Record<string, unknown>;
const strip = (r: Row, ...keys: string[]) => {
  const o: Row = { ...r };
  for (const k of keys) delete o[k];
  return o;
};

/**
 * Restaure une sauvegarde : remplace toutes les données actuelles (dans une transaction).
 * Les médicaments ne sont remplacés que si la sauvegarde les contient.
 */
export async function importData(userId: string, raw: unknown) {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "Fichier de sauvegarde invalide ou incompatible.");
  const b = parsed.data;
  const withUser = (r: Row) => ({ ...r, userId });

  await prisma.$transaction(
    async (tx) => {
      await tx.activity.deleteMany({ where: { userId } });
      await tx.lesson.deleteMany({ where: { userId } });
      await tx.student.deleteMany({ where: { userId } });
      await tx.project.deleteMany({ where: { userId } });
      await tx.germanSession.deleteMany({ where: { userId } });
      await tx.flashcard.deleteMany({ where: { userId } });
      await tx.sportSession.deleteMany({ where: { userId } });
      await tx.sportProfile.deleteMany({ where: { userId } });
      await tx.mediaItem.deleteMany({ where: { userId } });
      await tx.leisureIdea.deleteMany({ where: { userId } });
      await tx.energyCheckin.deleteMany({ where: { userId } });
      await tx.weeklyReview.deleteMany({ where: { userId } });
      await tx.category.deleteMany({ where: { userId } });
      if (b.includesHealth) await tx.medication.deleteMany({ where: { userId } });

      if (b.user?.settings) await tx.user.update({ where: { id: userId }, data: { settings: b.user.settings } });
      await tx.category.createMany({ data: b.categories.map((c: Row) => withUser(strip(c, "userId"))) as never });
      await tx.student.createMany({ data: b.students.map((s: Row) => withUser(strip(s, "userId", "resources"))) as never });
      await tx.resource.createMany({ data: b.students.flatMap((s: Row) => (s.resources as Row[]) ?? []) as never });
      await tx.lesson.createMany({ data: b.lessons.map((l: Row) => withUser(strip(l, "userId", "prepItems", "resources"))) as never });
      await tx.prepItem.createMany({ data: b.lessons.flatMap((l: Row) => (l.prepItems as Row[]) ?? []) as never });
      await tx.resource.createMany({ data: b.lessons.flatMap((l: Row) => ((l.resources as Row[]) ?? []).filter((r) => !r.studentId)) as never });
      await tx.project.createMany({ data: b.projects.map((p: Row) => withUser(strip(p, "userId", "tasks", "events"))) as never });
      await tx.projectTask.createMany({ data: b.projects.flatMap((p: Row) => (p.tasks as Row[]) ?? []) as never });
      await tx.projectEvent.createMany({ data: b.projects.flatMap((p: Row) => (p.events as Row[]) ?? []) as never });
      await tx.activity.createMany({ data: b.activities.map((a: Row) => withUser(strip(a, "userId", "exceptions"))) as never });
      await tx.activityException.createMany({ data: b.activities.flatMap((a: Row) => (a.exceptions as Row[]) ?? []) as never });
      await tx.germanSession.createMany({ data: b.germanSessions.map((g: Row) => withUser(strip(g, "userId"))) as never });
      await tx.flashcard.createMany({ data: b.flashcards.map((f: Row) => withUser(strip(f, "userId"))) as never });
      await tx.sportSession.createMany({ data: b.sportSessions.map((s: Row) => withUser(strip(s, "userId"))) as never });
      if (b.sportProfile) await tx.sportProfile.create({ data: withUser(strip(b.sportProfile, "userId", "id")) as never });
      await tx.mediaItem.createMany({ data: b.media.map((m: Row) => withUser(strip(m, "userId"))) as never });
      await tx.leisureIdea.createMany({ data: b.leisure.map((m: Row) => withUser(strip(m, "userId"))) as never });
      await tx.energyCheckin.createMany({ data: b.energy.map((e: Row) => withUser(strip(e, "userId"))) as never });
      await tx.weeklyReview.createMany({ data: b.reviews.map((r: Row) => withUser(strip(r, "userId"))) as never });
      if (b.includesHealth) {
        for (const m of b.medications as Row[]) {
          const { name, dosage, instructions, logs, ...rest } = m;
          await tx.medication.create({
            data: {
              ...(strip(rest, "userId") as { startDate: string }),
              userId,
              nameEnc: encrypt(String(name ?? "Médicament")),
              dosageEnc: encryptOpt(dosage as string | null),
              instructionsEnc: encryptOpt(instructions as string | null),
              logs: { create: ((logs as Row[]) ?? []).map((l) => strip(l, "medicationId")) as never },
            },
          });
        }
      }
    },
    { timeout: 60_000 },
  );
  return { ok: true };
}
