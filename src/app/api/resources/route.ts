import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { body, route } from "@/lib/api";

const schema = z.object({
  studentId: z.string().optional(),
  lessonId: z.string().optional(),
  type: z.enum(["COURS", "FICHE", "EXERCICE", "DOCUMENT", "LIEN"]),
  title: z.string().trim().min(1, "Titre obligatoire").max(200),
  url: z.union([z.string().url("Lien invalide"), z.literal("")]).optional(),
  content: z.string().max(20000).optional(),
});

export const POST = route(async ({ req, user }) => {
  const d = await body(req, schema);
  if (!d.studentId && !d.lessonId) throw new HttpError(400, "Ressource à rattacher à un élève ou une séance");
  if (d.studentId) await prisma.student.findFirstOrThrow({ where: { id: d.studentId, userId: user.id } });
  if (d.lessonId) await prisma.lesson.findFirstOrThrow({ where: { id: d.lessonId, userId: user.id } });
  return prisma.resource.create({ data: { ...d, url: d.url || null } });
});
