import { z } from "zod";
import { boolish, idSchema, intInRange, optString, reqString } from "./common";

const access = z.enum(["FREE", "PREMIUM"]);

export const courseSchema = z.object({
  subjectId: idSchema,
  title: reqString(160),
  summary: optString(600),
  accessLevel: access,
  isDemo: boolish,
});

export const lessonSchema = z.object({
  title: reqString(160),
  content: reqString(50_000),
  durationMinutes: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 600) {
        ctx.addIssue({ code: "custom", message: "invalidNumber" });
        return z.NEVER;
      }
      return n;
    }),
  accessLevel: access,
});

export const resourceMetaSchema = z.object({
  subjectId: idSchema,
  courseId: optString(64),
  title: reqString(160),
  description: optString(600),
  type: z.enum(["REVISION_SHEET", "EXERCISES", "CORRECTION", "SUMMARY", "METHODOLOGY", "OTHER"]),
  accessLevel: access,
  isDemo: boolish,
});

export const quizSchema = z.object({
  subjectId: idSchema,
  courseId: optString(64),
  title: reqString(160),
  description: optString(600),
  accessLevel: access,
  passingScore: intInRange(0, 100),
  timeLimitMinutes: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 300), "invalidNumber"),
  isDemo: boolish,
});

export const questionSchema = z
  .object({
    prompt: reqString(1000),
    type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE"]),
    options: z.array(z.string().trim().max(300, "tooLong")).max(8),
    correct: z.array(z.coerce.number().int().min(0)).max(8),
    explanation: optString(1500),
    points: intInRange(1, 20),
  })
  .transform((d, ctx) => {
    // On retire les propositions vides en recalculant les index des bonnes réponses.
    const kept: string[] = [];
    const correct: number[] = [];
    d.options.forEach((o, i) => {
      if (!o) return;
      if (d.correct.includes(i)) correct.push(kept.length);
      kept.push(o);
    });
    if (kept.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "optionsMin" });
    if (correct.length === 0) ctx.addIssue({ code: "custom", path: ["correct"], message: "correctRequired" });
    if (d.type === "SINGLE_CHOICE" && correct.length > 1) ctx.addIssue({ code: "custom", path: ["correct"], message: "correctRequired" });
    return { ...d, options: kept, correct };
  });

export type CourseInput = z.input<typeof courseSchema>;
export type LessonInput = z.input<typeof lessonSchema>;
export type QuizInput = z.input<typeof quizSchema>;
export type QuestionInput = z.input<typeof questionSchema>;
