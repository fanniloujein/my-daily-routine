import type { Activity, ActivityException, Category } from "@prisma/client";
import { prisma } from "@/lib/db";
import { expandDates } from "@/lib/recurrence";
import { addMinutesToTime, type DateStr } from "@/lib/dates";
import { HttpError } from "@/lib/auth";

export type Occurrence = {
  key: string;
  id: string;
  date: DateStr; // date effective (après déplacement éventuel)
  originalDate: DateStr;
  title: string;
  categoryId: string;
  category: { id: string; name: string; color: string; icon: string; kind: string | null; balance: string };
  startTime: string | null;
  endTime: string | null;
  durationMin: number;
  priority: number;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "POSTPONED";
  isFixed: boolean;
  energyCost: number;
  dueDate: string | null;
  reminders: number[];
  recurrence: string;
  interval: number;
  weekdays: number[];
  until: string | null;
  description: string | null;
  notes: string | null;
  postponeCount: number;
  lessonId: string | null;
  lessonRole: string | null;
  projectTaskId: string | null;
  germanSessionId: string | null;
  sportSessionId: string | null;
  mediaItemId: string | null;
  isRecurring: boolean;
  isDemo: boolean;
};

type Full = Activity & { category: Category; exceptions: ActivityException[] };

function toOcc(a: Full, originalDate: DateStr, ex?: ActivityException): Occurrence {
  const recurring = a.recurrence !== "NONE";
  const startTime = ex?.startTime ?? a.startTime;
  let endTime = ex?.endTime ?? a.endTime;
  if (startTime && !endTime) endTime = addMinutesToTime(startTime, a.durationMin);
  return {
    key: `${a.id}:${originalDate}`,
    id: a.id,
    date: ex?.newDate ?? originalDate,
    originalDate,
    title: a.title,
    categoryId: a.categoryId,
    category: { id: a.category.id, name: a.category.name, color: a.category.color, icon: a.category.icon, kind: a.category.kind, balance: a.category.balance },
    startTime,
    endTime,
    durationMin: a.durationMin,
    priority: a.priority,
    status: (ex?.status ?? (recurring ? "TODO" : a.status)) as Occurrence["status"],
    isFixed: a.isFixed,
    energyCost: a.energyCost,
    dueDate: a.dueDate,
    reminders: a.reminders,
    recurrence: a.recurrence,
    interval: a.interval,
    weekdays: a.weekdays,
    until: a.until,
    description: a.description,
    notes: a.notes,
    postponeCount: a.postponeCount,
    lessonId: a.lessonId,
    lessonRole: a.lessonRole,
    projectTaskId: a.projectTaskId,
    germanSessionId: a.germanSessionId,
    sportSessionId: a.sportSessionId,
    mediaItemId: a.mediaItemId,
    isRecurring: recurring,
    isDemo: a.isDemo,
  };
}

/** Toutes les occurrences (récurrences développées, exceptions appliquées) entre from et to. */
export async function getOccurrences(userId: string, from: DateStr, to: DateStr): Promise<Occurrence[]> {
  const activities = await prisma.activity.findMany({
    where: {
      userId,
      OR: [
        { recurrence: "NONE", date: { gte: from, lte: to } },
        { recurrence: { not: "NONE" }, date: { lte: to }, OR: [{ until: null }, { until: { gte: from } }] },
        { recurrence: { not: "NONE" }, exceptions: { some: { newDate: { gte: from, lte: to } } } },
      ],
    },
    include: { category: true, exceptions: true },
  });

  const out: Occurrence[] = [];
  for (const a of activities) {
    if (a.recurrence === "NONE") {
      out.push(toOcc(a, a.date));
      continue;
    }
    const exByDate = new Map(a.exceptions.map((e) => [e.date, e]));
    const seen = new Set<string>();
    for (const d of expandDates(a, from, to)) {
      const ex = exByDate.get(d);
      if (ex?.cancelled) continue;
      const occ = toOcc(a, d, ex);
      if (occ.date < from || occ.date > to) continue;
      out.push(occ);
      seen.add(d);
    }
    // Occurrences déplacées depuis une date hors de la plage
    for (const ex of a.exceptions) {
      if (!ex.cancelled && ex.newDate && ex.newDate >= from && ex.newDate <= to && !seen.has(ex.date)) out.push(toOcc(a, ex.date, ex));
    }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date) || (x.startTime ?? "99").localeCompare(y.startTime ?? "99") || y.priority - x.priority);
}

export async function getActivityOwned(userId: string, id: string) {
  const a = await prisma.activity.findFirst({ where: { id, userId } });
  if (!a) throw new HttpError(404, "Activité introuvable");
  return a;
}

/**
 * Applique une modification à une seule occurrence.
 * - Activité unique : on modifie l'activité directement.
 * - Activité récurrente : on crée/complète une exception pour cette date.
 */
export async function patchOccurrence(
  userId: string,
  id: string,
  originalDate: DateStr,
  patch: { status?: Occurrence["status"]; newDate?: DateStr; startTime?: string | null; endTime?: string | null; cancelled?: boolean },
) {
  const a = await getActivityOwned(userId, id);
  if (a.recurrence === "NONE") {
    const data: Record<string, unknown> = {};
    if (patch.status) {
      data.status = patch.status;
      data.completedAt = patch.status === "DONE" ? new Date() : null;
    }
    if (patch.newDate) data.date = patch.newDate;
    if (patch.startTime !== undefined) data.startTime = patch.startTime;
    if (patch.endTime !== undefined) data.endTime = patch.endTime;
    if (patch.cancelled) return prisma.activity.delete({ where: { id } });
    return prisma.activity.update({ where: { id }, data });
  }
  const data = {
    ...(patch.status ? { status: patch.status, completedAt: patch.status === "DONE" ? new Date() : null } : {}),
    ...(patch.newDate ? { newDate: patch.newDate === originalDate ? null : patch.newDate } : {}),
    ...(patch.startTime !== undefined ? { startTime: patch.startTime } : {}),
    ...(patch.endTime !== undefined ? { endTime: patch.endTime } : {}),
    ...(patch.cancelled ? { cancelled: true } : {}),
  };
  return prisma.activityException.upsert({
    where: { activityId_date: { activityId: id, date: originalDate } },
    create: { activityId: id, date: originalDate, ...data },
    update: data,
  });
}
