import { prisma } from "@/lib/prisma";

export const PUBLIC_TEACHER_WHERE = { status: "APPROVED" as const, user: { status: "ACTIVE" as const } };

export async function getActiveLevelsWithSubjects() {
  return prisma.educationalLevel.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    include: {
      subjects: {
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: { _count: { select: { courses: { where: { status: "PUBLISHED" } } } } },
      },
    },
  });
}

export async function getActivePlans() {
  return prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: [{ order: "asc" }, { priceMillimes: "asc" }] });
}

export async function listPublicTeachers(filters: { subjectId?: string; mode?: "ONLINE" | "IN_PERSON"; city?: string; take?: number }) {
  return prisma.teacherProfile.findMany({
    where: {
      ...PUBLIC_TEACHER_WHERE,
      ...(filters.subjectId ? { subjects: { some: { subjectId: filters.subjectId } } } : {}),
      ...(filters.mode === "ONLINE" ? { offersOnline: true } : {}),
      ...(filters.mode === "IN_PERSON" ? { offersInPerson: true } : {}),
      ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" as const } } : {}),
    },
    include: { user: { select: { name: true } }, subjects: { include: { subject: true } } },
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { createdAt: "asc" }],
    take: filters.take ?? 60,
  });
}

export type PublicTeacher = Awaited<ReturnType<typeof listPublicTeachers>>[number];
