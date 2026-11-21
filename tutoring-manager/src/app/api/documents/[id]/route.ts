import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";

type P = { id: string };
const opt = z.string().optional().nullable().transform((v) => (v ? v : null));
const schema = z.object({ name: z.string().trim().min(1).max(200), type: z.string().max(20), tags: opt, studentId: opt, subjectId: opt, levelId: opt, chapterId: opt, lessonId: opt });

export const PUT = route<P>(async ({ req, params }) => prisma.document.update({ where: { id: params.id }, data: await body(req, schema), select: { id: true } }));
export const DELETE = route<P>(async ({ params }) => {
  await prisma.document.delete({ where: { id: params.id } });
});
