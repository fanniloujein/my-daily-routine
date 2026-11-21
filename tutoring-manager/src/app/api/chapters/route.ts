import { prisma } from "@/lib/db";
import { route, body, qs } from "@/lib/api";
import { chapterSchema } from "@/lib/validation";

// Arborescence pédagogique : Matière → Niveau → Chapitre → Leçons
export const GET = route(async ({ req }) => {
  const p = qs(req);
  return prisma.chapter.findMany({
    where: { ...(p.get("subjectId") ? { subjectId: p.get("subjectId")! } : {}), ...(p.get("levelId") ? { levelId: p.get("levelId")! } : {}) },
    include: {
      subject: { select: { id: true, name: true, color: true } },
      level: { select: { id: true, name: true } },
      lessons: { select: { id: true, title: true, status: true, updatedAt: true, _count: { select: { exercises: true, sessions: true, documents: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
});

export const POST = route(async ({ req }) => prisma.chapter.create({ data: await body(req, chapterSchema) }));
