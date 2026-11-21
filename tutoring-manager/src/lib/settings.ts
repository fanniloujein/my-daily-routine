import { z } from "zod";

// Réglages de l'application (stockés dans User.settings, JSON validé).
export const settingsSchema = z.object({
  appName: z.string().trim().min(1).max(60).default("Fanni's Tutoring Manager"),
  teacherName: z.string().trim().max(80).default("Fanni"),
  phone: z.string().trim().max(40).default(""),
  contactEmail: z.string().trim().max(120).default(""),
  address: z.string().trim().max(200).default(""),
  defaultRate: z.number().min(0).max(100000).default(25),
  defaultDuration: z.number().int().min(15).max(480).default(60),
  defaultLocation: z.string().trim().max(120).default(""),
  dayStart: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
  dayEnd: z.string().regex(/^\d{2}:\d{2}$/).default("20:00"),
  maxDailyHours: z.number().min(1).max(16).default(6),
  breakMinutes: z.number().int().min(0).max(120).default(15),
  lateAbsenceBillableDefault: z.boolean().default(false),
  enabledPaymentMethods: z.array(z.enum(["CASH", "TRANSFER", "OTHER"])).default(["CASH", "TRANSFER", "OTHER"]),
  locale: z.enum(["fr", "ar", "en"]).default("fr"),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  notifications: z
    .object({
      upcomingHours: z.number().int().min(1).max(48).default(3),
      unprepared: z.boolean().default(true),
      postponed: z.boolean().default(true),
      pendingPayment: z.boolean().default(true),
      pendingPaymentDays: z.number().int().min(0).max(90).default(7),
      lowCredit: z.boolean().default(true),
      packageRenewal: z.boolean().default(true),
      urgentTasks: z.boolean().default(true),
      deadlines: z.boolean().default(true),
      deadlineDays: z.number().int().min(0).max(30).default(2),
    })
    .default({}),
});

export type Settings = z.infer<typeof settingsSchema>;

export function readSettings(raw: unknown): Settings {
  const r = settingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : settingsSchema.parse({});
}
