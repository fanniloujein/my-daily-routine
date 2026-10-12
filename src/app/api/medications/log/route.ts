import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { dateStr, timeStr } from "@/lib/validation";

const schema = z.object({ medicationId: z.string(), date: dateStr, time: timeStr, status: z.enum(["TAKEN", "MISSED", "PENDING"]) });

/** Confirmer une prise (prise / manquée) ou annuler la confirmation. */
export const POST = route(async ({ req, user }) => {
  const d = await body(req, schema);
  await prisma.medication.findFirstOrThrow({ where: { id: d.medicationId, userId: user.id } });
  const key = { medicationId_date_time: { medicationId: d.medicationId, date: d.date, time: d.time } };
  if (d.status === "PENDING") {
    await prisma.medicationLog.deleteMany({ where: { medicationId: d.medicationId, date: d.date, time: d.time } });
    return { ok: true };
  }
  return prisma.medicationLog.upsert({
    where: key,
    create: { medicationId: d.medicationId, date: d.date, time: d.time, status: d.status, takenAt: d.status === "TAKEN" ? new Date() : null },
    update: { status: d.status, takenAt: d.status === "TAKEN" ? new Date() : null },
  });
});
