import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { homeworkSchema } from "@/lib/validation";

type P = { id: string };
export const PUT = route<P>(async ({ req, params }) => prisma.homework.update({ where: { id: params.id }, data: await body(req, homeworkSchema) }));
export const PATCH = route<P>(async ({ req, params }) => prisma.homework.update({ where: { id: params.id }, data: await body(req, homeworkSchema.partial()) }));
export const DELETE = route<P>(async ({ params }) => {
  await prisma.homework.delete({ where: { id: params.id } });
});
