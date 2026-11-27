import { z } from "zod";
import { boolish, emailSchema, idSchema, intInRange, optString, reqString, slugSchema, tndAmount } from "./common";

const lines = z
  .string()
  .max(3000, "tooLong")
  .optional()
  .transform((v) => (v ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20));

export const planSchema = z.object({
  code: z.string().trim().toUpperCase().min(2, "required").max(40, "tooLong").regex(/^[A-Z0-9_]+$/, "invalidSlug"),
  name: reqString(100),
  nameAr: optString(100),
  description: optString(400),
  descriptionAr: optString(400),
  price: tndAmount,
  durationDays: intInRange(1, 400),
  features: lines,
  featuresAr: lines,
  levelId: optString(64),
  isFeatured: boolish,
  isActive: boolish,
  order: intInRange(0, 1000),
});

export const levelSchema = z.object({
  name: reqString(120),
  nameAr: optString(120),
  slug: slugSchema,
  description: optString(400),
  category: z.enum(["PRIMARY", "LOWER_SECONDARY", "SECONDARY", "BACCALAUREATE", "HIGHER_EDUCATION", "PROFESSIONAL_TRAINING"]),
  order: intInRange(0, 1000),
});

export const subjectSchema = z.object({
  levelId: idSchema,
  name: reqString(120),
  nameAr: optString(120),
  slug: slugSchema,
  icon: optString(40),
  description: optString(400),
  order: intInRange(0, 1000),
});

export const settingsSchema = z.object({
  contactEmail: z.union([z.literal(""), emailSchema]),
  contactPhone: optString(40),
  paymentInstructions: reqString(2000),
  paymentInstructionsAr: reqString(2000),
  enabledPaymentMethods: z.array(z.enum(["BANK_TRANSFER", "POSTAL_TRANSFER", "MOBILE_WALLET", "CASH"])).min(1, "required"),
});

export type PlanInput = z.input<typeof planSchema>;
export type LevelInput = z.input<typeof levelSchema>;
export type SubjectInput = z.input<typeof subjectSchema>;
export type SettingsInput = z.input<typeof settingsSchema>;
