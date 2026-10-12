import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { medicationSchema } from "@/lib/validation";
import { encrypt, encryptOpt } from "@/lib/crypto";
import { ambiguityWarnings } from "@/lib/meds";
import { decryptMed } from "@/server/meds";

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const existing = await prisma.medication.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  const raw = (await req.clone().json().catch(() => ({}))) as { confirmAmbiguous?: boolean };
  const d = await body(req, medicationSchema);
  const warnings = ambiguityWarnings(d);
  if (warnings.length && !raw.confirmAmbiguous) return Response.json({ needsConfirmation: true, warnings }, { status: 422 });
  const m = await prisma.medication.update({
    where: { id: existing.id },
    data: {
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

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await prisma.medication.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  await prisma.medication.delete({ where: { id: params.id } });
  return { ok: true };
});
