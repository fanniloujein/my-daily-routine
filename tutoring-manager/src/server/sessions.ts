import { Prisma, type SessionStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma, type Tx } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import type { SessionInput } from "@/lib/validation";
import { weeklyDates } from "@/lib/schedule";
import { duration, shortDate } from "@/lib/dates";
import { milToDecimalString, toMil } from "@/lib/money";
import { conflictsFor, sessionInclude } from "./schedule";
import { financeTx, syncSessionBilling } from "./finance";

const dec = (n: number) => new Prisma.Decimal(milToDecimalString(toMil(n)));

export class ConflictError extends HttpError {
  constructor(public conflicts: { date: string; startTime: string; endTime: string; with: string[] }[]) {
    super(409, `Conflit horaire : ${conflicts.map((c) => `${shortDate(c.date)} ${c.startTime}–${c.endTime} (${c.with.join(", ")})`).slice(0, 3).join(" ; ")}${conflicts.length > 3 ? "…" : ""}`);
  }
}

function base(v: SessionInput) {
  return {
    title: v.title,
    subjectId: v.subjectId,
    levelId: v.levelId,
    startTime: v.startTime,
    endTime: v.endTime,
    location: v.location,
    chapter: v.chapter,
    objectives: v.objectives,
    preparationNeeded: v.preparationNeeded,
    prepared: v.prepared,
    notes: v.notes,
    report: v.report,
    lateAbsenceBillable: v.lateAbsenceBillable,
  };
}

/** Création d'une séance unique ou d'une série récurrente. */
export async function createSessions(v: SessionInput) {
  const dates = v.repeat ? weeklyDates(v.date, v.repeat.weekdays, v.repeat.until) : [v.date];
  if (!dates.length) throw new HttpError(400, "Aucune date ne correspond à la récurrence choisie.");
  const students = await prisma.student.findMany({ where: { id: { in: v.participants.map((p) => p.studentId) } } });
  if (students.length !== v.participants.length) throw new HttpError(400, "Élève introuvable.");

  let finalDates = dates;
  if (!v.force) {
    const found = await conflictsFor(dates.map((date) => ({ date, startTime: v.startTime, endTime: v.endTime })));
    if (found.length && v.skipConflicts) {
      const bad = new Set(found.map((f) => f.slot.date));
      finalDates = dates.filter((d) => !bad.has(d));
      if (!finalDates.length) throw new HttpError(409, "Toutes les dates de la récurrence sont déjà occupées.");
    } else if (found.length) {
      throw new ConflictError(found.map((f) => ({ ...f.slot, with: f.conflicts.map((c) => c.label ?? "") })));
    }
  }
  const status: SessionStatus = finalDates.length > 1 ? "PLANNED" : v.status;
  const seriesId = finalDates.length > 1 ? randomUUID() : null;
  const isDemo = students.length > 0 && students.every((s) => s.isDemo);

  return financeTx(async (tx) => {
    const created = [];
    for (const date of finalDates) {
      const s = await tx.session.create({
        data: {
          ...base(v),
          date,
          status,
          seriesId,
          isDemo,
          completedAt: status === "DONE" ? new Date() : null,
          participants: { create: v.participants.map((p) => ({ studentId: p.studentId, price: dec(p.price), absent: p.absent })) },
          lessons: { create: v.lessonIds.map((lessonId) => ({ lessonId })) },
        },
      });
      if (status !== "PLANNED") await syncSessionBilling(tx, s.id);
      created.push(s);
    }
    return { created: created.length, skipped: dates.length - finalDates.length, ids: created.map((c) => c.id), seriesId };
  });
}

async function assertFree(tx: Tx, id: string, date: string, startTime: string, endTime: string) {
  const found = await conflictsFor([{ id, date, startTime, endTime }], tx, [id]);
  if (found.length) throw new ConflictError(found.map((f) => ({ ...f.slot, with: f.conflicts.map((c) => c.label ?? "") })));
}

/** Modification complète d'une séance (participants, tarifs, contenu, statut). */
export async function updateSession(id: string, v: SessionInput) {
  const cur = await prisma.session.findUnique({ where: { id } });
  if (!cur) throw new HttpError(404, "Séance introuvable.");
  return financeTx(async (tx) => {
    const moved = cur.date !== v.date || cur.startTime !== v.startTime || cur.endTime !== v.endTime;
    if (moved && !v.force && !["CANCELLED", "POSTPONED", "TEACHER_ABSENT"].includes(v.status)) await assertFree(tx, id, v.date, v.startTime, v.endTime);
    await tx.sessionParticipant.deleteMany({ where: { sessionId: id } });
    await tx.sessionLesson.deleteMany({ where: { sessionId: id } });
    await tx.session.update({
      where: { id },
      data: {
        ...base(v),
        date: v.date,
        status: v.status,
        completedAt: v.status === "DONE" ? cur.completedAt ?? new Date() : null,
        participants: { create: v.participants.map((p) => ({ studentId: p.studentId, price: dec(p.price), absent: p.absent })) },
        lessons: { create: v.lessonIds.map((lessonId) => ({ lessonId })) },
      },
    });
    await syncSessionBilling(tx, id);
    return tx.session.findUnique({ where: { id }, include: sessionInclude });
  });
}

/** Changement rapide : statut, déplacement (glisser-déposer), préparation, compte rendu. */
export async function patchSession(
  id: string,
  v: { status?: SessionStatus; date?: string; startTime?: string; endTime?: string; prepared?: boolean; report?: string | null; lateAbsenceBillable?: boolean; force?: boolean },
) {
  const cur = await prisma.session.findUnique({ where: { id } });
  if (!cur) throw new HttpError(404, "Séance introuvable.");
  const date = v.date ?? cur.date, startTime = v.startTime ?? cur.startTime, endTime = v.endTime ?? cur.endTime;
  if (duration(startTime, endTime) <= 0) throw new HttpError(400, "L'heure de fin doit être après l'heure de début.");
  return financeTx(async (tx) => {
    const moved = date !== cur.date || startTime !== cur.startTime || endTime !== cur.endTime;
    if (moved && !v.force) await assertFree(tx, id, date, startTime, endTime);
    const status = v.status ?? cur.status;
    await tx.session.update({
      where: { id },
      data: {
        date,
        startTime,
        endTime,
        status,
        prepared: v.prepared ?? undefined,
        report: v.report !== undefined ? v.report : undefined,
        lateAbsenceBillable: v.lateAbsenceBillable ?? undefined,
        completedAt: status === "DONE" ? cur.completedAt ?? new Date() : null,
      },
    });
    if (v.status !== undefined || v.lateAbsenceBillable !== undefined) await syncSessionBilling(tx, id);
    return tx.session.findUnique({ where: { id }, include: sessionInclude });
  });
}

/** Reporter : la séance passe en « Reportée » (non facturée) et une nouvelle séance est programmée. */
export async function postponeSession(id: string, to: { date: string; startTime: string; endTime: string; force?: boolean }) {
  const cur = await prisma.session.findUnique({ where: { id }, include: { participants: true, lessons: true } });
  if (!cur) throw new HttpError(404, "Séance introuvable.");
  return financeTx(async (tx) => {
    if (!to.force) await assertFree(tx, id, to.date, to.startTime, to.endTime);
    const next = await tx.session.create({
      data: {
        title: cur.title,
        subjectId: cur.subjectId,
        levelId: cur.levelId,
        location: cur.location,
        chapter: cur.chapter,
        objectives: cur.objectives,
        preparationNeeded: cur.preparationNeeded,
        prepared: cur.prepared,
        lateAbsenceBillable: cur.lateAbsenceBillable,
        isDemo: cur.isDemo,
        date: to.date,
        startTime: to.startTime,
        endTime: to.endTime,
        status: "PLANNED",
        notes: [cur.notes, `Report de la séance du ${shortDate(cur.date)} ${cur.startTime}`].filter(Boolean).join("\n"),
      },
    });
    await tx.sessionParticipant.createMany({ data: cur.participants.map((p) => ({ sessionId: next.id, studentId: p.studentId, price: p.price, absent: false })) });
    await tx.sessionLesson.createMany({ data: cur.lessons.map((l) => ({ sessionId: next.id, lessonId: l.lessonId })) });
    await tx.session.update({ where: { id }, data: { status: "POSTPONED", postponedToId: next.id, completedAt: null } });
    await syncSessionBilling(tx, id);
    return next;
  });
}

export async function duplicateSession(id: string, to: { date: string; startTime?: string; endTime?: string; force?: boolean }) {
  const cur = await prisma.session.findUnique({ where: { id }, include: { participants: true, lessons: true } });
  if (!cur) throw new HttpError(404, "Séance introuvable.");
  const startTime = to.startTime ?? cur.startTime, endTime = to.endTime ?? cur.endTime;
  if (!to.force) await assertFree(prisma, "", to.date, startTime, endTime);
  return prisma.session.create({
    data: {
      title: cur.title,
      subjectId: cur.subjectId,
      levelId: cur.levelId,
      date: to.date,
      startTime,
      endTime,
      location: cur.location,
      chapter: cur.chapter,
      objectives: cur.objectives,
      preparationNeeded: cur.preparationNeeded,
      notes: cur.notes,
      lateAbsenceBillable: cur.lateAbsenceBillable,
      status: "PLANNED",
      participants: { create: cur.participants.map((p) => ({ studentId: p.studentId, price: p.price })) },
      lessons: { create: cur.lessons.map((l) => ({ lessonId: l.lessonId })) },
    },
  });
}

/** Suppression : les factures liées sont annulées avec trace avant la suppression. */
export async function deleteSessions(ids: string[]) {
  return financeTx(async (tx) => {
    for (const id of ids) {
      const s = await tx.session.findUnique({ where: { id } });
      if (!s) continue;
      await tx.session.update({ where: { id }, data: { status: "CANCELLED" } });
      await syncSessionBilling(tx, id); // annule les factures éventuelles (journalisé)
      await tx.session.delete({ where: { id } });
    }
    return { deleted: ids.length };
  });
}
