"use server";
/**
 * Gestion du contenu pédagogique.
 * - Administrateur : tous les droits, y compris publication.
 * - Enseignant validé : crée et modifie SES brouillons dans SES matières ; ne publie jamais.
 */
import { revalidatePath } from "next/cache";
import type { PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, runAction, zodFail, type ActionResult } from "@/lib/action";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { slugify } from "@/lib/validation/common";
import { courseSchema, lessonSchema, questionSchema, quizSchema, resourceMetaSchema } from "@/lib/validation/content";
import { savePdfUpload } from "@/server/storage";
import { audit } from "@/server/audit";

async function staff() {
  return requireUser("ADMIN", "TEACHER");
}

/** Un enseignant doit être validé et enseigner la matière. */
async function assertTeacherSubject(user: CurrentUser, subjectId: string) {
  if (user.role === "ADMIN") return;
  const profile = await prisma.teacherProfile.findUnique({ where: { userId: user.id }, include: { subjects: true } });
  if (!profile || profile.status !== "APPROVED") throw new AppError("teacherNotApproved");
  if (!profile.subjects.some((s) => s.subjectId === subjectId)) throw new AppError("subjectNotTaught");
}

async function loadEditableCourse(user: CurrentUser, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AppError("notFound");
  if (user.role === "ADMIN") return course;
  if (course.authorId !== user.id) throw new AppError("notFound");
  if (course.status !== "DRAFT") throw new AppError("forbidden");
  return course;
}

async function uniqueCourseSlug(subjectId: string, title: string, excludeId?: string) {
  const base = slugify(title) || "cours";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const clash = await prisma.course.findFirst({ where: { subjectId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) } });
    if (!clash) return slug;
  }
  return `${base}-${Date.now()}`;
}

function revalidateContent() {
  revalidatePath("/admin", "layout");
  revalidatePath("/teacher", "layout");
  revalidatePath("/student", "layout");
}

// ─────────── Cours ───────────

export async function createCourseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await staff();
    const parsed = courseSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const d = parsed.data;
    await assertTeacherSubject(user, d.subjectId);
    const course = await prisma.course.create({
      data: {
        subjectId: d.subjectId,
        title: d.title,
        summary: d.summary,
        accessLevel: d.accessLevel,
        isDemo: user.role === "ADMIN" ? d.isDemo : false,
        slug: await uniqueCourseSlug(d.subjectId, d.title),
        status: "DRAFT",
        authorId: user.id,
      },
    });
    revalidateContent();
    return { ok: true, data: { id: course.id } };
  });
}

export async function updateCourseAction(courseId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await staff();
    const course = await loadEditableCourse(user, courseId);
    const parsed = courseSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const d = parsed.data;
    await assertTeacherSubject(user, d.subjectId);
    await prisma.course.update({
      where: { id: course.id },
      data: {
        subjectId: d.subjectId,
        title: d.title,
        summary: d.summary ?? null,
        accessLevel: d.accessLevel,
        isDemo: user.role === "ADMIN" ? d.isDemo : course.isDemo,
        slug: d.subjectId !== course.subjectId || d.title !== course.title ? await uniqueCourseSlug(d.subjectId, d.title, course.id) : course.slug,
      },
    });
    revalidateContent();
    return { ok: true };
  });
}

export async function setCourseStatusAction(courseId: string, status: PublishStatus): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("ADMIN");
    await prisma.course.update({ where: { id: courseId }, data: { status, publishedAt: status === "PUBLISHED" ? new Date() : undefined } });
    await audit(user.id, `course.${status.toLowerCase()}`, "Course", courseId);
    revalidateContent();
    return { ok: true };
  });
}

export async function deleteCourseAction(courseId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await staff();
    await loadEditableCourse(user, courseId);
    await prisma.$transaction([
      prisma.educationalResource.updateMany({ where: { courseId }, data: { courseId: null } }),
      prisma.quiz.updateMany({ where: { courseId }, data: { courseId: null } }),
      prisma.course.delete({ where: { id: courseId } }),
    ]);
    await audit(user.id, "course.delete", "Course", courseId);
    revalidateContent();
    return { ok: true };
  });
}

// ─────────── Leçons ───────────

export async function saveLessonAction(courseId: string, lessonId: string | null, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await staff();
    await loadEditableCourse(user, courseId);
    const parsed = lessonSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const d = parsed.data;
    if (lessonId) {
      const res = await prisma.lesson.updateMany({ where: { id: lessonId, courseId }, data: d });
      if (res.count === 0) throw new AppError("notFound");
    } else {
      const last = await prisma.lesson.aggregate({ where: { courseId }, _max: { order: true } });
      await prisma.lesson.create({ data: { ...d, courseId, order: (last._max.order ?? 0) + 1 } });
    }
    revalidateContent();
    return { ok: true };
  });
}

export async function deleteLessonAction(courseId: string, lessonId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await staff();
    await loadEditableCourse(user, courseId);
    await prisma.lesson.deleteMany({ where: { id: lessonId, courseId } });
    revalidateContent();
    return { ok: true };
  });
}

export async function moveLessonAction(courseId: string, lessonId: string, direction: "up" | "down"): Promise<ActionResult> {
  return runAction(async () => {
    const user = await staff();
    await loadEditableCourse(user, courseId);
    const lessons = await prisma.lesson.findMany({ where: { courseId }, orderBy: { order: "asc" }, select: { id: true } });
    const i = lessons.findIndex((l) => l.id === lessonId);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lessons.length) return { ok: true };
    [lessons[i], lessons[j]] = [lessons[j], lessons[i]];
    await prisma.$transaction(lessons.map((l, k) => prisma.lesson.update({ where: { id: l.id }, data: { order: k + 1 } })));
    revalidateContent();
    return { ok: true };
  });
}

// ─────────── Ressources PDF ───────────

export async function createResourceAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await staff();
    const parsed = resourceMetaSchema.safeParse({
      subjectId: formData.get("subjectId"),
      courseId: formData.get("courseId") || undefined,
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      type: formData.get("type"),
      accessLevel: formData.get("accessLevel"),
      isDemo: formData.get("isDemo") ?? undefined,
    });
    if (!parsed.success) return zodFail(parsed.error);
    const d = parsed.data;
    await assertTeacherSubject(user, d.subjectId);
    if (d.courseId) {
      // Un enseignant ne peut rattacher une fiche qu'à ses propres cours.
      const course = await prisma.course.findFirst({
        where: { id: d.courseId, subjectId: d.subjectId, ...(user.role === "ADMIN" ? {} : { authorId: user.id }) },
      });
      if (!course) return { ok: false, error: "validation", fieldErrors: { courseId: "notFound" } };
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "fileRequired", fieldErrors: { file: "fileRequired" } };
    const fileId = await savePdfUpload(file);
    const publishNow = user.role === "ADMIN" && formData.get("publishNow") === "on";
    await prisma.educationalResource.create({
      data: {
        subjectId: d.subjectId,
        courseId: d.courseId ?? null,
        title: d.title,
        description: d.description,
        type: d.type,
        accessLevel: d.accessLevel,
        isDemo: user.role === "ADMIN" ? d.isDemo : false,
        fileId,
        uploadedById: user.id,
        status: publishNow ? "PUBLISHED" : "DRAFT",
        publishedAt: publishNow ? new Date() : null,
      },
    });
    revalidateContent();
    return { ok: true };
  });
}

export async function setResourceStatusAction(resourceId: string, status: PublishStatus): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("ADMIN");
    await prisma.educationalResource.update({ where: { id: resourceId }, data: { status, publishedAt: status === "PUBLISHED" ? new Date() : undefined } });
    await audit(user.id, `resource.${status.toLowerCase()}`, "EducationalResource", resourceId);
    revalidateContent();
    return { ok: true };
  });
}

export async function setResourceAccessAction(resourceId: string, accessLevel: "FREE" | "PREMIUM"): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser("ADMIN");
    await prisma.educationalResource.update({ where: { id: resourceId }, data: { accessLevel } });
    revalidateContent();
    return { ok: true };
  });
}

export async function deleteResourceAction(resourceId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await staff();
    const r = await prisma.educationalResource.findUnique({ where: { id: resourceId } });
    if (!r) throw new AppError("notFound");
    if (user.role !== "ADMIN" && (r.uploadedById !== user.id || r.status !== "DRAFT")) throw new AppError("forbidden");
    await prisma.$transaction(async (tx) => {
      await tx.educationalResource.delete({ where: { id: r.id } });
      if (r.fileId) {
        const others = await tx.educationalResource.count({ where: { fileId: r.fileId } });
        if (others === 0) await tx.storedFile.delete({ where: { id: r.fileId } });
      }
    });
    await audit(user.id, "resource.delete", "EducationalResource", r.id);
    revalidateContent();
    return { ok: true };
  });
}

// ─────────── QCM (administrateur) ───────────

export async function createQuizAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser("ADMIN");
    const parsed = quizSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const d = parsed.data;
    const quiz = await prisma.quiz.create({ data: { ...d, courseId: d.courseId ?? null, status: "DRAFT", authorId: user.id } });
    revalidateContent();
    return { ok: true, data: { id: quiz.id } };
  });
}

export async function updateQuizAction(quizId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser("ADMIN");
    const parsed = quizSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    await prisma.quiz.update({ where: { id: quizId }, data: { ...parsed.data, courseId: parsed.data.courseId ?? null } });
    revalidateContent();
    return { ok: true };
  });
}

export async function setQuizStatusAction(quizId: string, status: PublishStatus): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("ADMIN");
    if (status === "PUBLISHED" && (await prisma.question.count({ where: { quizId } })) === 0) throw new AppError("quizEmpty");
    await prisma.quiz.update({ where: { id: quizId }, data: { status } });
    await audit(user.id, `quiz.${status.toLowerCase()}`, "Quiz", quizId);
    revalidateContent();
    return { ok: true };
  });
}

export async function deleteQuizAction(quizId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser("ADMIN");
    await prisma.quiz.delete({ where: { id: quizId } });
    await audit(user.id, "quiz.delete", "Quiz", quizId);
    revalidateContent();
    return { ok: true };
  });
}

export async function saveQuestionAction(quizId: string, questionId: string | null, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser("ADMIN");
    const parsed = questionSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const d = parsed.data;
    const data = { prompt: d.prompt, type: d.type, options: d.options, correctOptions: d.correct, explanation: d.explanation ?? null, points: d.points };
    if (questionId) {
      const res = await prisma.question.updateMany({ where: { id: questionId, quizId }, data });
      if (res.count === 0) throw new AppError("notFound");
    } else {
      const last = await prisma.question.aggregate({ where: { quizId }, _max: { order: true } });
      await prisma.question.create({ data: { ...data, quizId, order: (last._max.order ?? 0) + 1 } });
    }
    revalidateContent();
    return { ok: true };
  });
}

export async function deleteQuestionAction(quizId: string, questionId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser("ADMIN");
    await prisma.question.deleteMany({ where: { id: questionId, quizId } });
    revalidateContent();
    return { ok: true };
  });
}
