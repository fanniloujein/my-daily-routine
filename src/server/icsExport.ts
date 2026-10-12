import { prisma } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { buildIcs, rruleFor, type IcsEvent } from "@/lib/ics";
import { readSettings } from "@/lib/validation";
import { decryptMed } from "./meds";

/** Agenda iCalendar : activités (avec récurrences et alarmes) + prises de médicaments. */
export async function buildUserIcs(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const settings = readSettings(user.settings);
  const from = addDays(today(), -30);
  const activities = await prisma.activity.findMany({
    where: { userId, OR: [{ date: { gte: from } }, { recurrence: { not: "NONE" } }] },
    include: { exceptions: true },
  });
  const events: IcsEvent[] = [];
  for (const a of activities) {
    if (a.recurrence !== "NONE" && a.until && a.until < from) continue;
    events.push({
      uid: `${a.id}@mylifeos`,
      title: a.title,
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      durationMin: a.durationMin,
      description: a.description,
      alarmsMin: a.startTime ? a.reminders : [],
      rrule: rruleFor(a),
    });
  }
  const meds = await prisma.medication.findMany({ where: { userId, active: true } });
  for (const raw of meds) {
    const m = decryptMed(raw);
    const title = settings.icsHideMedNames ? "Rappel santé" : `Médicament — ${m.name}`;
    for (const time of m.times) {
      const rrule =
        m.frequency === "WEEKDAYS"
          ? rruleFor({ recurrence: "WEEKLY", interval: 1, weekdays: m.weekdays, until: m.endDate })
          : rruleFor({ recurrence: "DAILY", interval: m.frequency === "EVERY_N_DAYS" ? m.everyNDays : 1, weekdays: [], until: m.endDate });
      events.push({
        uid: `${m.id}-${time.replace(":", "")}@mylifeos`,
        title,
        date: m.startDate,
        startTime: time,
        durationMin: 5,
        description: "Selon ta prescription. En cas de doute, vérifie ton ordonnance ou consulte ton professionnel de santé.",
        alarmsMin: [m.reminderOffset],
        rrule,
      });
    }
  }
  return buildIcs(events);
}
