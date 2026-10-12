import type { Medication, MedicationLog } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptOpt } from "@/lib/crypto";
import { dosesForDay, reminderTime } from "@/lib/meds";
import { nowTime, today, type DateStr } from "@/lib/dates";

export function decryptMed(m: Medication) {
  const { nameEnc, dosageEnc, instructionsEnc, ...rest } = m;
  return { ...rest, name: decryptOpt(nameEnc) ?? "", dosage: decryptOpt(dosageEnc), instructions: decryptOpt(instructionsEnc) };
}

export type Dose = {
  medicationId: string;
  name: string;
  dosage: string | null;
  instructions: string | null;
  date: DateStr;
  time: string;
  reminderAt: string;
  status: "TAKEN" | "MISSED" | "PENDING" | "LATE";
  takenAt: Date | null;
};

/**
 * Prises prévues pour une date, avec leur statut :
 * TAKEN / MISSED (confirmé par l'utilisatrice), PENDING (à prendre), LATE (heure passée, non confirmée).
 * Les jours passés non confirmés apparaissent comme MISSED dans l'historique.
 */
export async function dosesFor(userId: string, date: DateStr): Promise<Dose[]> {
  const meds = await prisma.medication.findMany({
    where: { userId, active: true, startDate: { lte: date }, OR: [{ endDate: null }, { endDate: { gte: date } }] },
    include: { logs: { where: { date } } },
  });
  const t = today();
  const now = nowTime();
  const out: Dose[] = [];
  for (const m of meds as (Medication & { logs: MedicationLog[] })[]) {
    const dm = decryptMed(m);
    for (const time of dosesForDay(m, date)) {
      const log = m.logs.find((l) => l.time === time);
      let status: Dose["status"] = log ? (log.status as "TAKEN" | "MISSED") : "PENDING";
      if (!log && (date < t || (date === t && time < now))) status = date < t ? "MISSED" : "LATE";
      out.push({ medicationId: m.id, name: dm.name, dosage: dm.dosage, instructions: dm.instructions, date, time, reminderAt: reminderTime(time, m.reminderOffset), status, takenAt: log?.takenAt ?? null });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
