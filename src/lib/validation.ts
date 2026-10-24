import { z } from "zod";
import { isValidDateStr, isValidTimeStr, timeToMin } from "./dates";

export const dateStr = z.string().refine(isValidDateStr, "Date invalide (format AAAA-MM-JJ)");
export const timeStr = z.string().refine(isValidTimeStr, "Heure invalide (format HH:MM)");
const optTime = z.union([timeStr, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));
const optDate = z.union([dateStr, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));
const optText = z.string().max(5000).nullish().transform((v) => (v && v.trim() ? v.trim() : null));

export const activitySchema = z
  .object({
    title: z.string().trim().min(1, "Le titre est obligatoire").max(200),
    categoryId: z.string().min(1, "Choisis une catégorie"),
    date: dateStr,
    startTime: optTime,
    endTime: optTime,
    durationMin: z.coerce.number().int().min(5, "5 minutes minimum").max(24 * 60).default(30),
    priority: z.coerce.number().int().min(1).max(4).default(2),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE", "POSTPONED"]).default("TODO"),
    description: optText,
    notes: optText,
    isFixed: z.boolean().default(false),
    energyCost: z.coerce.number().int().min(1).max(3).default(2),
    dueDate: optDate,
    reminders: z.array(z.coerce.number().int().min(0).max(10080)).max(5).default([]),
    recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "CUSTOM"]).default("NONE"),
    interval: z.coerce.number().int().min(1).max(52).default(1),
    weekdays: z.array(z.number().int().min(0).max(6)).default([]),
    until: optDate,
  })
  .superRefine((a, ctx) => {
    if (a.startTime && a.endTime && timeToMin(a.endTime) <= timeToMin(a.startTime)) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "L'heure de fin doit être après l'heure de début" });
    }
    if (a.endTime && !a.startTime) {
      ctx.addIssue({ code: "custom", path: ["startTime"], message: "Indique une heure de début" });
    }
    if (a.until && a.until < a.date) {
      ctx.addIssue({ code: "custom", path: ["until"], message: "La fin de récurrence doit être après la date de début" });
    }
    if (a.recurrence === "CUSTOM" && a.weekdays.length === 0) {
      ctx.addIssue({ code: "custom", path: ["weekdays"], message: "Choisis au moins un jour" });
    }
  });

export type ActivityInput = z.infer<typeof activitySchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Nom obligatoire").max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide").default("#7aa7e0"),
  icon: z.string().max(40).default("tag"),
  balance: z.enum(["work", "rest", "health", "personal"]).default("personal"),
  reminderMinutes: z.coerce.number().int().min(0).max(1440).nullish(),
});

export const energySchema = z.object({
  date: dateStr,
  energy: z.coerce.number().int().min(1).max(5),
  mood: z.coerce.number().int().min(1).max(5).nullish(),
  stress: z.coerce.number().int().min(1).max(5).nullish(),
  note: optText,
});

export const studentSchema = z.object({
  name: z.string().trim().min(1, "Nom obligatoire").max(100),
  level: optText,
  subjects: optText,
  goals: optText,
  notes: optText,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8fb3e8"),
  archived: z.boolean().default(false),
  isGroup: z.boolean().default(false),
  memberIds: z.array(z.string()).max(50).optional(),
});

export const lessonSchema = z
  .object({
    studentId: z.string().min(1, "Choisis un·e élève"),
    date: dateStr,
    startTime: timeStr,
    endTime: timeStr,
    subject: z.string().trim().min(1, "Matière obligatoire").max(100),
    chapter: optText,
    prepMinutes: z.coerce.number().int().min(0).max(600).default(60),
    prepDate: optDate, // date souhaitée pour la préparation (sinon : la veille)
    status: z.enum(["PLANNED", "DONE", "CANCELLED"]).default("PLANNED"),
    remarks: optText,
    nextSteps: optText,
    recurrenceWeeks: z.coerce.number().int().min(0).max(40).default(0), // séances hebdomadaires répétées
  })
  .refine((l) => timeToMin(l.endTime) > timeToMin(l.startTime), { path: ["endTime"], message: "L'heure de fin doit être après le début" });

export const projectSchema = z.object({
  client: z.string().trim().min(1, "Client obligatoire").max(120),
  name: z.string().trim().min(1, "Nom du projet obligatoire").max(160),
  description: optText,
  deadline: optDate,
  budget: z.coerce.number().min(0).nullish(),
  status: z.enum(["PROSPECT", "ACTIVE", "ON_HOLD", "DONE"]).default("ACTIVE"),
  priority: z.coerce.number().int().min(1).max(4).default(2),
  nextAction: optText,
  notes: optText,
  links: z.array(z.object({ label: z.string().max(100), url: z.string().url("Lien invalide") })).default([]),
  template: z.boolean().optional(), // créer les tâches types d'un site web
});

export const projectTaskSchema = z.object({
  title: z.string().trim().min(1, "Titre obligatoire").max(200),
  description: optText,
  status: z.enum(["TODO", "IN_PROGRESS", "WAITING", "DONE"]).default("TODO"),
  priority: z.coerce.number().int().min(1).max(4).default(2),
  estimateMin: z.coerce.number().int().min(0).max(100000).default(60),
  spentMin: z.coerce.number().int().min(0).max(100000).default(0),
  dueDate: optDate,
  order: z.coerce.number().int().default(0),
});

export const projectEventSchema = z.object({
  type: z.enum(["MEETING", "DELIVERABLE"]),
  title: z.string().trim().min(1).max(200),
  date: dateStr,
  time: optTime,
  done: z.boolean().default(false),
});

export const germanSessionSchema = z.object({
  date: dateStr,
  startTime: optTime,
  durationMin: z.coerce.number().refine((v) => [15, 30, 45, 60].includes(v), "Durée : 15, 30, 45 ou 60 minutes"),
  topic: z.enum(["VOCAB", "GRAMMAR", "EXPRESSIONS", "INTERVIEW", "LISTENING", "SPEAKING", "WRITING", "ERRORS"]),
  objective: z.string().trim().min(1, "Objectif obligatoire").max(300),
  done: z.boolean().default(false),
  rating: z.coerce.number().int().min(1).max(5).nullish(),
  notes: optText,
});

export const flashcardSchema = z.object({
  front: z.string().trim().min(1, "Recto obligatoire").max(300),
  back: z.string().trim().min(1, "Verso obligatoire").max(500),
  example: optText,
  topic: z.enum(["VOCAB", "GRAMMAR", "EXPRESSIONS", "INTERVIEW", "LISTENING", "SPEAKING", "WRITING", "ERRORS"]).default("VOCAB"),
});

export const medicationSchema = z
  .object({
    name: z.string().trim().min(1, "Nom obligatoire").max(120),
    dosage: optText,
    instructions: optText,
    times: z.array(timeStr).min(1, "Indique au moins un horaire prescrit").max(12),
    frequency: z.enum(["DAILY", "WEEKDAYS", "EVERY_N_DAYS"]).default("DAILY"),
    weekdays: z.array(z.number().int().min(0).max(6)).default([]),
    everyNDays: z.coerce.number().int().min(1).max(60).default(1),
    startDate: dateStr,
    endDate: optDate,
    reminderOffset: z.coerce.number().int().min(0).max(120).default(0),
    active: z.boolean().default(true),
  })
  .refine((m) => m.frequency !== "WEEKDAYS" || m.weekdays.length > 0, { path: ["weekdays"], message: "Choisis les jours prescrits" })
  .refine((m) => !m.endDate || m.endDate >= m.startDate, { path: ["endDate"], message: "La date de fin doit suivre la date de début" });

export const sportProfileSchema = z.object({
  goal: optText,
  weeklySessions: z.coerce.number().int().min(0).max(14),
  weeklyMinutes: z.coerce.number().int().min(0).max(3000),
  preferred: z.array(z.string().max(60)).max(20).default([]),
  availableDays: z.array(z.number().int().min(0).max(6)).default([]),
  defaultDuration: z.coerce.number().int().min(5).max(300),
  preferredTime: optTime,
});

export const sportSessionSchema = z.object({
  date: dateStr,
  startTime: optTime,
  type: z.string().trim().min(1, "Type obligatoire").max(80),
  durationMin: z.coerce.number().int().min(5).max(600),
  intensity: z.coerce.number().int().min(1).max(3).default(2),
  status: z.enum(["PLANNED", "DONE", "SKIPPED"]).default("PLANNED"),
  notes: optText,
});

export const mediaSchema = z.object({
  title: z.string().trim().min(1, "Titre obligatoire").max(200),
  type: z.enum(["MOVIE", "SERIES"]).default("MOVIE"),
  genre: optText,
  durationMin: z.coerce.number().int().min(1).max(10000).default(110),
  status: z.enum(["TO_WATCH", "WATCHING", "DONE"]).default("TO_WATCH"),
  liked: z.boolean().default(false),
  rating: z.coerce.number().int().min(1).max(5).nullish(),
  notes: optText,
});

export const leisureSchema = z.object({
  title: z.string().trim().min(1).max(200),
  durationMin: z.coerce.number().int().min(5).max(600).default(30),
  minEnergy: z.coerce.number().int().min(1).max(5).default(1),
  kind: z.enum(["RELAX", "MOVE", "CREATIVE", "SOCIAL", "READ"]).default("RELAX"),
});

export const settingsSchema = z.object({
  dayStart: timeStr.default("08:00"),
  workEnd: timeStr.default("19:00"),
  dayEnd: timeStr.default("22:30"),
  breakMin: z.coerce.number().int().min(0).max(60).default(10),
  lunchStart: optTime,
  lunchEnd: optTime,
  germanWeeklyMinutes: z.coerce.number().int().min(0).max(3000).default(120),
  privacyMode: z.boolean().default(true),
  icsHideMedNames: z.boolean().default(true),
});

export type UserSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: UserSettings = {
  dayStart: "08:00",
  workEnd: "19:00",
  dayEnd: "22:30",
  breakMin: 10,
  lunchStart: "12:30",
  lunchEnd: "13:30",
  germanWeeklyMinutes: 120,
  privacyMode: true,
  icsHideMedNames: true,
};

export function readSettings(raw: unknown): UserSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}
