import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { addDays, formatTime, minutesUntil, timeToMin, today, type DateStr } from "@/lib/dates";
import { PREP_CHECKLIST } from "@/lib/constants";
import { categoryForKind } from "./categories";
import { findSlot } from "./scheduling";

export type LessonCreate = {
  studentId: string;
  date: DateStr;
  startTime: string;
  endTime: string;
  subject: string;
  chapter: string | null;
  prepMinutes: number;
  prepDate: DateStr | null;
  remarks?: string | null;
  nextSteps?: string | null;
  isDemo?: boolean;
};

/**
 * Crée une séance + sa checklist de préparation + les créneaux dans l'agenda :
 *  - la séance elle-même (rendez-vous fixe),
 *  - un créneau de préparation réservé AVANT la séance (veille par défaut).
 */
export async function createLesson(userId: string, input: LessonCreate) {
  const student = await prisma.student.findFirst({ where: { id: input.studentId, userId } });
  if (!student) throw new HttpError(404, "Élève introuvable");
  const [tutoring, prep] = await Promise.all([categoryForKind(userId, "tutoring"), categoryForKind(userId, "prep")]);

  const lesson = await prisma.lesson.create({
    data: {
      userId,
      studentId: student.id,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      subject: input.subject,
      chapter: input.chapter,
      prepMinutes: input.prepMinutes,
      remarks: input.remarks ?? null,
      nextSteps: input.nextSteps ?? null,
      isDemo: !!input.isDemo,
      prepItems: { create: PREP_CHECKLIST.map((label, order) => ({ label, order })) },
    },
  });

  const durationMin = timeToMin(input.endTime) - timeToMin(input.startTime);
  await prisma.activity.create({
    data: {
      userId,
      categoryId: tutoring.id,
      title: `Cours — ${student.name} (${input.subject})`,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMin,
      priority: 3,
      isFixed: true,
      energyCost: 2,
      reminders: tutoring.reminderMinutes != null ? [tutoring.reminderMinutes] : [60],
      lessonId: lesson.id,
      lessonRole: "session",
      description: input.chapter ? `Chapitre : ${input.chapter}` : null,
      isDemo: !!input.isDemo,
    },
  });

  let prepPlaced: { date: string; startTime: string; endTime: string } | null = null;
  if (input.prepMinutes > 0) {
    const t = today();
    let from = input.prepDate ?? addDays(input.date, -1);
    if (from < t) from = t;
    if (from > input.date) from = input.date;
    // On cherche un créneau entre la date souhaitée et le début de la séance
    prepPlaced = await findSlot(userId, {
      from,
      to: input.date,
      duration: input.prepMinutes,
      before: { date: input.date, time: input.startTime },
    });
    await prisma.activity.create({
      data: {
        userId,
        categoryId: prep.id,
        title: `Préparer le cours — ${student.name} (${input.subject})`,
        date: prepPlaced?.date ?? from,
        startTime: prepPlaced?.startTime ?? null,
        endTime: prepPlaced?.endTime ?? null,
        durationMin: input.prepMinutes,
        priority: 3,
        energyCost: 2,
        dueDate: input.date,
        reminders: prep.reminderMinutes != null ? [prep.reminderMinutes] : [15],
        lessonId: lesson.id,
        lessonRole: "prep",
        description: PREP_CHECKLIST.map((l) => `• ${l}`).join("\n"),
        isDemo: !!input.isDemo,
      },
    });
  }
  return { lesson, prepPlaced };
}

export type Readiness = { state: "ready" | "on_track" | "at_risk" | "past"; progress: number; message: string };

/** Évalue si la préparation sera prête à temps. */
export function lessonReadiness(
  lesson: { date: string; startTime: string; prepMinutes: number; status: string },
  items: { done: boolean }[],
  prepActivity?: { date: string; startTime: string | null; status: string } | null,
): Readiness {
  const total = items.length || 1;
  const done = items.filter((i) => i.done).length;
  const progress = Math.round((done / total) * 100);
  const minutesLeft = minutesUntil(lesson.date, lesson.startTime);
  if (lesson.status !== "PLANNED" || minutesLeft < 0) return { state: "past", progress, message: "Séance passée" };
  if (done === total || prepActivity?.status === "DONE") return { state: "ready", progress: 100, message: "Préparation terminée ✨" };
  const remainingPrep = Math.round((lesson.prepMinutes * (total - done)) / total);
  if (prepActivity?.startTime) {
    if (minutesUntil(prepActivity.date, prepActivity.startTime) < 0 && minutesLeft < remainingPrep + 180) {
      return { state: "at_risk", progress, message: "Le créneau de préparation est passé : il reste des étapes à faire avant la séance." };
    }
    return { state: "on_track", progress, message: `Préparation réservée le ${prepActivity.date.split("-").reverse().slice(0, 2).join("/")} à ${formatTime(prepActivity.startTime)}` };
  }
  if (minutesLeft < remainingPrep + 12 * 60) {
    return { state: "at_risk", progress, message: `Aucun créneau réservé et ~${remainingPrep} min de préparation restantes : risque de ne pas être prête.` };
  }
  return { state: "on_track", progress, message: "Préparation à planifier (aucun créneau réservé)" };
}
