import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { progressSchema } from "@/lib/validation";

// Avancement d'un élève par chapitre (unique par élève et chapitre)
export const POST = route(async ({ req }) => {
  const v = await body(req, progressSchema);
  return prisma.studentProgress.upsert({
    where: { studentId_chapterId: { studentId: v.studentId, chapterId: v.chapterId } },
    create: v,
    update: { status: v.status, notes: v.notes },
  });
});

export const DELETE = route(async ({ req }) => {
  const v = await body(req, z.object({ studentId: z.string(), chapterId: z.string() }));
  await prisma.studentProgress.delete({ where: { studentId_chapterId: v } });
});
