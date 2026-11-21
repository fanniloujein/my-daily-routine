// Schémas Zod partagés par les formulaires et l'API.
import { z } from "zod";
import { isDate, isTime, toMinutes } from "./dates";

const req = (label: string) => ({ required_error: `${label} : champ obligatoire`, invalid_type_error: `${label} : valeur invalide` });
const optStr = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Texte trop long (${max} caractères max.)`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
export const dateStr = (label = "Date") => z.string(req(label)).refine(isDate, `${label} : date invalide`);
export const timeStr = (label = "Heure") => z.string(req(label)).refine(isTime, `${label} : heure invalide (HH:mm)`);
const optDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isDate(v), "Date invalide");
const money = (label: string) =>
  z.coerce
    .number(req(label))
    .min(0, `${label} : doit être positif`)
    .max(1_000_000, `${label} : montant trop élevé`)
    .refine((n) => Math.round(n * 1000) === n * 1000 || Math.abs(Math.round(n * 1000) - n * 1000) < 1e-6, `${label} : 3 décimales maximum`);
const positiveMoney = (label: string) => money(label).refine((n) => n > 0, `${label} : doit être supérieur à 0`);
const id = z.string().min(1);
const optId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const studentSchema = z.object({
  firstName: z.string(req("Prénom")).trim().min(1, "Prénom obligatoire").max(60),
  lastName: z.string(req("Nom")).trim().min(1, "Nom obligatoire").max(60),
  photo: z
    .string()
    .max(400_000, "Photo trop lourde")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || v.startsWith("data:image/"), "Photo invalide"),
  phone: optStr(40),
  parentName: optStr(100),
  parentPhone: optStr(40),
  address: optStr(200),
  levelId: optId,
  school: optStr(120),
  subjectIds: z.array(id).default([]),
  enrolledAt: dateStr("Date d'inscription"),
  courseType: z.enum(["INDIVIDUAL", "GROUP"]).default("INDIVIDUAL"),
  rate: money("Tarif par séance"),
  sessionDuration: z.coerce.number().int().min(15, "Durée minimale : 15 min").max(480),
  sessionsPerWeek: z.coerce.number().int().min(0).max(14),
  billingMode: z.enum(["PER_SESSION", "ADVANCE", "MONTHLY"]).default("PER_SESSION"),
  availability: optStr(500),
  notes: optStr(4000),
  strengths: optStr(2000),
  weaknesses: optStr(2000),
  difficulties: optStr(2000),
  goals: optStr(2000),
  color: optStr(20),
});
export type StudentInput = z.infer<typeof studentSchema>;

export const subjectSchema = z.object({
  name: z.string(req("Nom")).trim().min(1, "Nom obligatoire").max(60),
  description: optStr(500),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide").default("#8fb8e8"),
  defaultRate: money("Tarif habituel").optional().nullable(),
  defaultDuration: z.coerce.number().int().min(15).max(480).default(60),
  levelIds: z.array(id).default([]),
  archived: z.boolean().optional(),
});

export const levelSchema = z.object({
  name: z.string(req("Nom")).trim().min(1, "Nom obligatoire").max(60),
  cycle: z.enum(["PRIMARY", "MIDDLE", "SECONDARY", "OTHER"]).default("OTHER"),
  order: z.coerce.number().int().default(0),
});

const timeRange = <T extends { startTime: string; endTime: string }>(v: T) => toMinutes(v.endTime) > toMinutes(v.startTime);
const timeRangeMsg = { message: "L'heure de fin doit être après l'heure de début", path: ["endTime"] };

export const sessionSchema = z
  .object({
    title: optStr(100),
    participants: z
      .array(z.object({ studentId: id, price: money("Tarif"), absent: z.boolean().default(false) }))
      .min(1, "Choisissez au moins un élève"),
    subjectId: optId,
    levelId: optId,
    date: dateStr(),
    startTime: timeStr("Heure de début"),
    endTime: timeStr("Heure de fin"),
    location: optStr(120),
    chapter: optStr(200),
    objectives: optStr(2000),
    preparationNeeded: optStr(2000),
    prepared: z.boolean().default(false),
    notes: optStr(4000),
    report: optStr(4000),
    status: z.enum(["PLANNED", "DONE", "CANCELLED", "POSTPONED", "STUDENT_ABSENT", "TEACHER_ABSENT"]).default("PLANNED"),
    lateAbsenceBillable: z.boolean().default(false),
    lessonIds: z.array(id).default([]),
    // Récurrence (création uniquement)
    repeat: z
      .object({ weekdays: z.array(z.number().int().min(1).max(7)).min(1, "Choisissez au moins un jour"), until: dateStr("Date de fin de la récurrence") })
      .optional()
      .nullable(),
    force: z.boolean().default(false), // créer malgré un conflit horaire
    skipConflicts: z.boolean().default(false), // récurrence : ignorer les dates en conflit
  })
  .refine(timeRange, timeRangeMsg)
  .refine((v) => new Set(v.participants.map((p) => p.studentId)).size === v.participants.length, { message: "Un élève apparaît deux fois", path: ["participants"] });
export type SessionInput = z.infer<typeof sessionSchema>;

export const sessionPatchSchema = z.object({
  status: z.enum(["PLANNED", "DONE", "CANCELLED", "POSTPONED", "STUDENT_ABSENT", "TEACHER_ABSENT"]).optional(),
  date: dateStr().optional(),
  startTime: timeStr().optional(),
  endTime: timeStr().optional(),
  prepared: z.boolean().optional(),
  report: optStr(4000),
  lateAbsenceBillable: z.boolean().optional(),
  force: z.boolean().default(false),
});

export const paymentSchema = z.object({
  studentId: id,
  kind: z.enum(["PAYMENT", "ADVANCE", "DISCOUNT"]).default("PAYMENT"),
  date: dateStr(),
  amount: positiveMoney("Montant"),
  method: z.enum(["CASH", "TRANSFER", "OTHER"]).default("CASH"),
  reason: optStr(200),
  reference: optStr(100),
  notes: optStr(1000),
  targetInvoiceIds: z.array(id).default([]),
});

export const refundSchema = z.object({
  studentId: id,
  date: dateStr(),
  amount: positiveMoney("Montant"),
  method: z.enum(["CASH", "TRANSFER", "OTHER"]).default("CASH"),
  reason: optStr(200),
});

export const adjustmentSchema = z.object({
  studentId: id,
  date: dateStr(),
  amount: positiveMoney("Montant"),
  label: z.string(req("Motif")).trim().min(3, "Précisez le motif de la correction").max(200),
});

export const voidSchema = z.object({ reason: z.string(req("Motif")).trim().min(3, "Indiquez le motif de l'annulation (trace obligatoire)").max(200) });

export const packageSchema = z.object({
  studentId: id,
  name: z.string().trim().min(1).max(80).default("Forfait mensuel"),
  amount: positiveMoney("Montant du forfait"),
  sessionsCount: z.coerce.number().int().min(0).max(100).optional().nullable(),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/, "Mois invalide"),
  endMonth: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}$/.test(v), "Mois invalide"),
  active: z.boolean().default(true),
  notes: optStr(500),
});

export const chapterSchema = z.object({ subjectId: id, levelId: optId, title: z.string().trim().min(1, "Titre obligatoire").max(150), order: z.coerce.number().int().default(0) });

export const lessonSchema = z.object({
  chapterId: id,
  title: z.string().trim().min(1, "Titre obligatoire").max(150),
  objectives: optStr(4000),
  content: optStr(20000),
  links: optStr(4000),
  notes: optStr(4000),
  status: z.enum(["DRAFT", "READY"]).default("DRAFT"),
  exercises: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().trim().min(1, "Titre de l'exercice obligatoire").max(150),
        statement: optStr(10000),
        correction: optStr(10000),
        difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
      }),
    )
    .default([]),
});

export const homeworkSchema = z.object({
  title: z.string().trim().min(1, "Titre obligatoire").max(150),
  type: z.enum(["TO_PREPARE", "TO_CORRECT", "TO_PRINT", "REVISION", "MOCK_EXAM", "TO_SUBMIT"]).default("TO_SUBMIT"),
  studentId: optId,
  subjectId: optId,
  levelId: optId,
  lessonId: optId,
  dueDate: optDate,
  status: z.enum(["PENDING", "DONE"]).default("PENDING"),
  grade: z.coerce.number().min(0).max(1000).optional().nullable(),
  maxGrade: z.coerce.number().min(1).max(1000).optional().nullable(),
  notes: optStr(2000),
});

export const progressSchema = z.object({ studentId: id, chapterId: id, status: z.enum(["DONE", "IN_PROGRESS", "TO_REVIEW"]), notes: optStr(2000) });

export const assessmentSchema = z
  .object({
    studentId: id,
    subjectId: optId,
    kind: z.enum(["HOMEWORK", "EXAM", "MOCK_EXAM", "QUIZ"]).default("HOMEWORK"),
    title: z.string().trim().min(1, "Titre obligatoire").max(150),
    date: dateStr(),
    score: z.coerce.number().min(0, "Note invalide"),
    maxScore: z.coerce.number().min(1, "Barème invalide").default(20),
    notes: optStr(1000),
  })
  .refine((v) => v.score <= v.maxScore, { message: "La note dépasse le barème", path: ["score"] });

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Titre obligatoire").max(150),
  description: optStr(4000),
  category: z.enum(["PREP", "CORRECTION", "STUDENTS", "ADMIN", "PRO_DEV", "PERSONAL", "SPORT", "REST", "OTHER"]).default("OTHER"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "POSTPONED"]).default("TODO"),
  dueDate: optDate,
  time: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isTime(v), "Heure invalide"),
  duration: z.coerce.number().int().min(0).max(1440).optional().nullable(),
  order: z.coerce.number().int().optional(),
});

export const timeEntrySchema = z.object({
  date: dateStr(),
  category: z.enum(["PREP", "CORRECTION", "ADMIN", "PERSONAL", "REST", "FREE", "OTHER"]),
  minutes: z.coerce.number().int().min(1, "Durée invalide").max(1440),
  note: optStr(300),
});

export const availabilitySchema = z.object({
  slots: z.array(z.object({ weekday: z.number().int().min(1).max(7), startTime: timeStr(), endTime: timeStr() }).refine(timeRange, timeRangeMsg)),
});

export const personalEventSchema = z
  .object({
    title: z.string().trim().min(1, "Titre obligatoire").max(120),
    kind: z.enum(["PERSONAL", "REST", "BREAK"]).default("PERSONAL"),
    date: dateStr(),
    startTime: timeStr("Heure de début"),
    endTime: timeStr("Heure de fin"),
    weeklyUntil: optDate,
    notes: optStr(1000),
  })
  .refine(timeRange, timeRangeMsg);

export const passwordSchema = z
  .object({
    current: z.string().min(1, "Mot de passe actuel obligatoire"),
    next: z.string().min(10, "10 caractères minimum").max(200).regex(/[A-Za-z]/, "Au moins une lettre").regex(/\d/, "Au moins un chiffre"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "Les deux mots de passe ne correspondent pas", path: ["confirm"] });

export const setupSchema = z.object({
  name: z.string().trim().min(1, "Nom obligatoire").max(80),
  email: z.string().trim().toLowerCase().email("E-mail invalide"),
  password: z.string().min(10, "10 caractères minimum").regex(/[A-Za-z]/, "Au moins une lettre").regex(/\d/, "Au moins un chiffre"),
  demo: z.boolean().default(false),
});
