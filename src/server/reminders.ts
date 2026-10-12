import { prisma } from "@/lib/db";
import { addDays, addMinutesToTime, timeToMin, type DateStr, formatTime } from "@/lib/dates";
import { getOccurrences } from "./occurrences";
import { dosesFor } from "./meds";
import { readSettings } from "@/lib/validation";

export type Reminder = {
  key: string;
  date: DateStr;
  time: string; // heure de déclenchement
  eventTime: string;
  title: string;
  body: string;
  kind: "activity" | "medication";
  medicationId?: string;
};

/** Rappels à venir pour aujourd'hui et demain (activités + prises de médicaments). */
export async function upcomingReminders(userId: string, from: DateStr): Promise<Reminder[]> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const privacy = readSettings(user.settings).privacyMode;
  const to = addDays(from, 1);
  const occ = await getOccurrences(userId, from, to);
  const out: Reminder[] = [];
  for (const o of occ) {
    if (!o.startTime || o.status === "DONE" || o.status === "POSTPONED") continue;
    for (const r of o.reminders) {
      const t = timeToMin(o.startTime) - r;
      const date = t < 0 ? addDays(o.date, -1) : o.date;
      const time = addMinutesToTime("00:00", ((t % 1440) + 1440) % 1440);
      out.push({
        key: `a:${o.key}:${r}`,
        date,
        time,
        eventTime: o.startTime,
        title: o.title,
        body: r === 0 ? `Maintenant (${o.category.name})` : `Dans ${r >= 60 ? `${Math.round((r / 60) * 10) / 10} h` : `${r} min`} — ${formatTime(o.startTime)}`,
        kind: "activity",
      });
    }
  }
  for (const d of [from, to]) {
    for (const dose of await dosesFor(userId, d)) {
      if (dose.status === "TAKEN" || dose.status === "MISSED") continue;
      out.push({
        key: `m:${dose.medicationId}:${d}:${dose.time}`,
        date: d,
        time: dose.reminderAt,
        eventTime: dose.time,
        title: privacy ? "Rappel santé 💊" : `💊 ${dose.name}`,
        body: `Prise prévue à ${formatTime(dose.time)} (selon ta prescription)`,
        kind: "medication",
        medicationId: dose.medicationId,
      });
    }
  }
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
