import { prisma } from "@/lib/db";
import { route } from "@/lib/api";

export const DELETE = route<{ id: string }>(async ({ params }) => {
  await prisma.assessment.delete({ where: { id: params.id } });
});
