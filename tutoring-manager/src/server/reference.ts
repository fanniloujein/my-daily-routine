import { prisma } from "@/lib/db";
import { DEFAULT_LEVELS, DEFAULT_SUBJECTS } from "@/lib/constants";

/** Crée les niveaux et matières par défaut s'ils n'existent pas (idempotent). */
export async function ensureReferenceData() {
  if ((await prisma.level.count()) === 0)
    await prisma.level.createMany({ data: DEFAULT_LEVELS.map((l, i) => ({ ...l, order: i })), skipDuplicates: true });
  if ((await prisma.subject.count()) === 0)
    await prisma.subject.createMany({ data: DEFAULT_SUBJECTS.map((s) => ({ ...s, defaultDuration: 60 })), skipDuplicates: true });
}
