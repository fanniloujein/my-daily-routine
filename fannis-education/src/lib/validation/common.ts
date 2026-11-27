import { z } from "zod";
import { parseTndToMillimes } from "@/lib/money";
import { hhmmToMinutes, isValidIsoDate } from "@/lib/time";

/** Les messages d'erreur sont des codes, traduits côté client (dictionnaire `errors`). */
export const reqString = (max = 200) =>
  z.string({ error: "required" }).trim().min(1, "required").max(max, "tooLong");

export const optString = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .optional()
    .transform((v) => (v ? v : undefined));

export const emailSchema = z
  .string({ error: "required" })
  .trim()
  .toLowerCase()
  .min(1, "required")
  .max(254, "tooLong")
  .pipe(z.email("invalidEmail"));

export const passwordSchema = z
  .string({ error: "required" })
  .min(8, "passwordMin")
  .max(128, "tooLong")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "passwordWeak");

/** Téléphone tunisien (8 chiffres) avec indicatif facultatif. */
export const phoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[\s.-]/g, "") : undefined))
  .refine((v) => !v || /^(\+216|00216)?[2-9]\d{7}$/.test(v), "invalidPhone");

export const idSchema = z.string().trim().min(1, "required").max(64);

/** Montant saisi en dinars ("10", "12,5") → millimes. */
export const tndAmount = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const m = parseTndToMillimes(v);
    if (m === null) {
      ctx.addIssue({ code: "custom", message: "invalidPrice" });
      return z.NEVER;
    }
    return m;
  });

export const optionalTndAmount = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === null || String(v).trim() === "") return null;
    const m = parseTndToMillimes(v);
    if (m === null) {
      ctx.addIssue({ code: "custom", message: "invalidPrice" });
      return z.NEVER;
    }
    return m;
  });

export const isoDate = z.string().refine(isValidIsoDate, "invalidDate");

export const hhmm = z.string().transform((v, ctx) => {
  const m = hhmmToMinutes(v);
  if (m === null) {
    ctx.addIssue({ code: "custom", message: "invalidTime" });
    return z.NEVER;
  }
  return m;
});

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "required")
  .max(80, "tooLong")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "invalidSlug");

export const boolish = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

export const intInRange = (min: number, max: number) =>
  z.coerce.number({ error: "invalidNumber" }).int("invalidNumber").min(min, "invalidNumber").max(max, "invalidNumber");

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
