import { prisma } from "@/lib/db";

/**
 * Effets de bord quand une activité liée à un module change de statut.
 * Exemple : terminer un créneau de développement ajoute le temps passé à la tâche du projet.
 */
export async function onActivityStatusChange(
  activity: { id: string; durationMin: number; projectTaskId: string | null; germanSessionId: string | null; sportSessionId: string | null; lessonId: string | null; lessonRole: string | null },
  previous: string,
  next: string,
) {
  if (previous === next) return;
  const becameDone = next === "DONE" && previous !== "DONE";
  const undone = previous === "DONE" && next !== "DONE";
  if (!becameDone && !undone) return;

  if (activity.projectTaskId) {
    const delta = becameDone ? activity.durationMin : -activity.durationMin;
    const task = await prisma.projectTask.findUnique({ where: { id: activity.projectTaskId } });
    if (task) {
      await prisma.projectTask.update({
        where: { id: task.id },
        data: {
          spentMin: Math.max(0, task.spentMin + delta),
          status: becameDone && task.status === "TODO" ? "IN_PROGRESS" : task.status,
        },
      });
    }
  }
  if (activity.germanSessionId) {
    await prisma.germanSession.updateMany({ where: { id: activity.germanSessionId }, data: { done: becameDone } });
  }
  if (activity.sportSessionId) {
    await prisma.sportSession.updateMany({ where: { id: activity.sportSessionId }, data: { status: becameDone ? "DONE" : "PLANNED" } });
  }
  if (activity.lessonId && activity.lessonRole === "session") {
    await prisma.lesson.updateMany({ where: { id: activity.lessonId }, data: { status: becameDone ? "DONE" : "PLANNED" } });
  }
  if (activity.lessonId && activity.lessonRole === "prep" && becameDone) {
    await prisma.prepItem.updateMany({ where: { lessonId: activity.lessonId }, data: { done: true } });
  }
}
