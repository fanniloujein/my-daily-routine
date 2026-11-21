import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { chapterSchema } from "@/lib/validation";

type P = { id: string };
export const PUT = route<P>(async ({ req, params }) => prisma.chapter.update({ where: { id: params.id }, data: await body(req, chapterSchema) }));
export const DELETE = route<P>(async ({ params }) => {
  await prisma.chapter.delete({ where: { id: params.id } });
});
