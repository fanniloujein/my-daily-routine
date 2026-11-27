import { prisma } from "@/lib/prisma";

export const hasDb = !!process.env.TEST_DATABASE_URL;

/** Vide toutes les tables de la base de TEST. */
export async function resetDb() {
  if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("Refus de vider une base qui n'est pas TEST_DATABASE_URL");
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
}

let n = 0;
export async function makeUser(role: "STUDENT" | "TEACHER" | "ADMIN" = "STUDENT") {
  n++;
  return prisma.user.create({ data: { email: `u${n}-${Date.now()}@test.local`, name: `Test ${role} ${n}`, role, passwordHash: "x" } });
}

export async function makeCatalog() {
  const level = await prisma.educationalLevel.create({ data: { slug: `lvl-${Date.now()}`, name: "Bac test" } });
  const subject = await prisma.subject.create({ data: { levelId: level.id, slug: "eco", name: "Économie" } });
  const plan = await prisma.subscriptionPlan.create({ data: { code: `M${Date.now()}`, name: "Mensuel", priceMillimes: 10_000, durationDays: 30 } });
  return { level, subject, plan };
}

/** Enseignant validé, disponible tous les jours 17:00–20:00 (heure de Tunis), séances de 60 min. */
export async function makeTeacher(subjectId: string, status: "APPROVED" | "PENDING" = "APPROVED") {
  const user = await makeUser("TEACHER");
  const profile = await prisma.teacherProfile.create({
    data: {
      userId: user.id,
      status,
      offersOnline: true,
      offersInPerson: true,
      onlinePriceMillimes: 25_000,
      inPersonPriceMillimes: 35_000,
      lessonDurationMinutes: 60,
      subjects: { create: { subjectId } },
      availabilities: { create: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startMinute: 17 * 60, endMinute: 20 * 60 })) },
    },
  });
  return { user, profile };
}
