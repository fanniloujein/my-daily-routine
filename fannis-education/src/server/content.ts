/**
 * Accès au contenu pédagogique. Toute décision « verrouillé / visible » passe par ici,
 * côté serveur : le contenu premium n'est jamais chargé pour un utilisateur sans droit.
 */
import { prisma } from "@/lib/prisma";
import { canAccessContent, type AccessLevel } from "@/lib/domain/subscription";
import type { CurrentUser } from "@/lib/auth/session";
import { getStudentAccess } from "./subscriptions";

export interface Viewer {
  id: string;
  role: CurrentUser["role"];
  hasPremium: boolean;
}

export async function getViewer(user: CurrentUser): Promise<Viewer> {
  const hasPremium = user.role === "STUDENT" ? (await getStudentAccess(user.id)).hasPremium : false;
  return { id: user.id, role: user.role, hasPremium };
}

export function viewerCan(viewer: Viewer, accessLevel: AccessLevel, authorId?: string | null) {
  return canAccessContent({ accessLevel, role: viewer.role, hasPremium: viewer.hasPremium, isAuthor: !!authorId && authorId === viewer.id });
}

/** Une leçon est accessible si elle est gratuite (aperçu) ou si le cours entier l'est pour ce lecteur. */
export function lessonAccessible(viewer: Viewer, course: { accessLevel: AccessLevel; authorId: string | null }, lesson: { accessLevel: AccessLevel }) {
  if (course.accessLevel === "FREE" || lesson.accessLevel === "FREE") return true;
  return viewerCan(viewer, "PREMIUM", course.authorId);
}

export async function getStudentLevel(userId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, include: { level: true } });
  return profile?.level ?? null;
}

/** Leçon pour un lecteur : le contenu n'est sélectionné que si l'accès est autorisé. */
export async function getLessonForViewer(viewer: Viewer, courseId: string, lessonId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      subject: true,
      lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, accessLevel: true, order: true, durationMinutes: true } },
    },
  });
  if (!course || (course.status !== "PUBLISHED" && viewer.role !== "ADMIN" && course.authorId !== viewer.id)) return null;
  const meta = course.lessons.find((l) => l.id === lessonId);
  if (!meta) return null;
  const accessible = lessonAccessible(viewer, course, meta);
  const content = accessible
    ? (await prisma.lesson.findUnique({ where: { id: lessonId }, select: { content: true } }))?.content ?? ""
    : null;
  return { course, lesson: meta, accessible, content };
}
