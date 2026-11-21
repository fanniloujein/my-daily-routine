import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { availabilitySchema } from "@/lib/validation";

export const GET = route(async () => prisma.availability.findMany({ orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }));

// Remplace l'ensemble des disponibilités hebdomadaires
export const PUT = route(async ({ req }) => {
  const { slots } = await body(req, availabilitySchema);
  await prisma.$transaction([prisma.availability.deleteMany({}), prisma.availability.createMany({ data: slots })]);
  return prisma.availability.findMany({ orderBy: [{ weekday: "asc" }, { startTime: "asc" }] });
});
