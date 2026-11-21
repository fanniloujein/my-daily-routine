import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { personalEventSchema } from "@/lib/validation";

type P = { id: string };
export const PUT = route<P>(async ({ req, params }) => prisma.personalEvent.update({ where: { id: params.id }, data: await body(req, personalEventSchema) }));
export const DELETE = route<P>(async ({ params }) => {
  await prisma.personalEvent.delete({ where: { id: params.id } });
});
