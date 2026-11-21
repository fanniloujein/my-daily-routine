import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { expandWeekly, findConflicts, type Block } from "@/lib/schedule";

/** Statuts qui libèrent le créneau. */
export const FREEING_STATUSES = ["CANCELLED", "POSTPONED", "TEACHER_ABSENT"] as const;

export type BusyBlock = Block & { kind: "SESSION" | "PERSONAL" | "REST" | "BREAK"; label: string };

/** Tout ce qui occupe l'agenda sur une période : séances actives et événements personnels. */
export async function busyBlocks(from: string, to: string, db: Tx = prisma, excludeSessionIds: string[] = []): Promise<BusyBlock[]> {
  const [sessions, events] = await Promise.all([
    db.session.findMany({
      where: { date: { gte: from, lte: to }, status: { notIn: [...FREEING_STATUSES] }, id: { notIn: excludeSessionIds } },
      include: { participants: { include: { student: true } }, subject: true },
    }),
    db.personalEvent.findMany({ where: { date: { lte: to }, OR: [{ weeklyUntil: null, date: { gte: from } }, { weeklyUntil: { gte: from } }] } }),
  ]);
  return [
    ...sessions.map((s) => ({
      id: s.id,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      kind: "SESSION" as const,
      label: `${s.title || s.participants.map((p) => `${p.student.firstName} ${p.student.lastName}`).join(", ")}${s.subject ? ` · ${s.subject.name}` : ""}`,
    })),
    ...expandWeekly(events, from, to).map((e) => ({ id: `pe:${e.id}:${e.occurrence}`, date: e.date, startTime: e.startTime, endTime: e.endTime, kind: e.kind as BusyBlock["kind"], label: e.title })),
  ];
}

export async function conflictsFor(slots: Block[], db: Tx = prisma, excludeSessionIds: string[] = []) {
  if (!slots.length) return [];
  const dates = slots.map((s) => s.date).sort();
  const busy = await busyBlocks(dates[0], dates[dates.length - 1], db, excludeSessionIds);
  return slots.map((slot) => ({ slot, conflicts: findConflicts(slot, busy) })).filter((x) => x.conflicts.length);
}

export const sessionInclude = {
  participants: { include: { student: { select: { id: true, firstName: true, lastName: true, billingMode: true, color: true, photo: true } } } },
  subject: true,
  level: true,
  lessons: { include: { lesson: { select: { id: true, title: true, status: true } } } },
  invoices: { where: { voidedAt: null }, select: { id: true, studentId: true, amount: true } },
} satisfies Prisma.SessionInclude;
