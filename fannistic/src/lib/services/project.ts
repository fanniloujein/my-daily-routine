import { z } from "zod";
import { UNSURE } from "./types";
import { isEmail } from "./logic";

/** Questions communes à tous les projets (budget, délai, précisions) et coordonnées. */

export const BUDGETS = [
  { value: "lt500", max: 500 },
  { value: "500-1500", min: 500, max: 1500 },
  { value: "1500-3000", min: 1500, max: 3000 },
  { value: "3000-6000", min: 3000, max: 6000 },
  { value: "gt6000", min: 6000 },
] as const;

export const DEADLINES = ["urgent", "2-4w", "1-2m", "flexible"] as const;
export const CONTACT_PREFS = ["email", "phone", "whatsapp", "video"] as const;

export const projectSchema = z.object({
  budget: z.enum([UNSURE, ...BUDGETS.map((b) => b.value as string)] as [string, ...string[]]).optional(),
  deadline: z.enum([...DEADLINES, UNSURE] as [string, ...string[]]).optional(),
  details: z.string().trim().max(4000, "tooLong").optional(),
});
export type ProjectAnswers = z.infer<typeof projectSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .optional()
    .transform((v) => (v ? v : undefined));

export const contactSchema = z.object({
  name: z.string().trim().min(2, "required").max(120, "tooLong"),
  email: z.string().trim().toLowerCase().max(200, "tooLong").refine(isEmail, "email"),
  phone: optionalText(40).refine((v) => !v || /^[+0-9 ().-]{6,40}$/.test(v), "tel"),
  company: optionalText(120),
  country: z.string().trim().min(2, "required").max(80, "tooLong"),
  contactPref: z.enum(CONTACT_PREFS, { errorMap: () => ({ message: "required" }) }),
  comments: optionalText(3000),
});
export type ContactInput = z.infer<typeof contactSchema>;

/** Le téléphone devient obligatoire si le client préfère être rappelé ou contacté sur WhatsApp. */
export function phoneRequired(pref: string | undefined) {
  return pref === "phone" || pref === "whatsapp";
}

export const submissionSchema = z.object({
  kind: z.enum(["QUOTE", "CALL"]),
  services: z.array(z.string().max(60)).min(1).max(12),
  answers: z.record(z.unknown()),
  project: projectSchema,
  contact: contactSchema,
  locale: z.enum(["fr", "en", "ar"]),
  consent: z.literal(true),
  // Anti-robots : champ caché qui doit rester vide, et temps passé sur le formulaire.
  website: z.string().max(0).optional(),
  startedAt: z.number().int().positive(),
});
export type SubmissionInput = z.infer<typeof submissionSchema>;
