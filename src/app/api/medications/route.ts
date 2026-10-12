import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { medicationSchema } from "@/lib/validation";
import { encrypt, encryptOpt } from "@/lib/crypto";
import { ambiguityWarnings, MED_DISCLAIMER } from "@/lib/meds";
import { decryptMed } from "@/server/meds";

export const GET = route(async ({ user }) => {
  const meds = await prisma.medication.findMany({ where: { userId: user.id }, orderBy: [{ active: "desc" }, { createdAt: "asc" }] });
  return { medications: meds.map(decryptMed), disclaimer: MED_DISCLAIMER };
});

/** Les données sont enregistrées telles que saisies (aucune interprétation), chiffrées en base. */
export const POST = route(async ({ req, user }) => {
  const raw = (await req.clone().json().catch(() => ({}))) as { confirmAmbiguous?: boolean };
  const d = await body(req, medicationSchema);
  const warnings = ambiguityWarnings(d);
  if (warnings.length && !raw.confirmAmbiguous) {
    return Response.json({ needsConfirmation: true, warnings }, { status: 422 });
  }
  const m = await prisma.medication.create({
    data: {
      userId: user.id,
      nameEnc: encrypt(d.name),
      dosageEnc: encryptOpt(d.dosage),
      instructionsEnc: encryptOpt(d.instructions),
      times: [...new Set(d.times)].sort(),
      frequency: d.frequency,
      weekdays: d.weekdays,
      everyNDays: d.everyNDays,
      startDate: d.startDate,
      endDate: d.endDate,
      reminderOffset: d.reminderOffset,
      active: d.active,
    },
  });
  return decryptMed(m);
});
