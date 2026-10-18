import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { PricingSettings } from "@/lib/services/logic";

const pricingSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/).default("EUR"),
  estimatesEnabled: z.boolean().default(true),
  urgentSurchargePercent: z.number().min(0).max(200).nullable().default(null),
});

const str = (max = 300) => z.string().trim().max(max).default("");

export const companySchema = z.object({
  tradeName: str(120).default("Fanni’stic"),
  legalName: str(),
  legalForm: str(),
  address: str(500),
  country: str(),
  registration: str(),
  vatNumber: str(),
  director: str(),
  email: str(),
  phone: str(),
  hosting: str(500),
  socials: z
    .object({ instagram: str(), facebook: str(), linkedin: str(), behance: str(), tiktok: str(), whatsapp: str() })
    .default({}),
});

export type CompanySettings = z.infer<typeof companySchema>;
export { pricingSchema };

/** Textes de la page d'accueil personnalisables par l'administrateur (par langue). */
export const CONTENT_KEYS = [
  "heroEyebrow",
  "heroTitle",
  "heroSubtitle",
  "ideaTitle",
  "ideaSubtitle",
  "servicesTitle",
  "servicesSubtitle",
  "portfolioTitle",
  "portfolioSubtitle",
  "whyTitle",
  "faqTitle",
  "finalTitle",
  "finalText",
] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];
const contentSchema = z.record(z.enum(["fr", "en", "ar"]), z.record(z.string(), z.string().max(400))).default({});
export type ContentOverrides = z.infer<typeof contentSchema>;

async function read<T>(key: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  const parsed = schema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : schema.parse({});
}

export async function writeSetting(key: string, value: unknown) {
  const v = value as Prisma.InputJsonValue;
  await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
}

export const getPricing = (): Promise<PricingSettings> => read("pricing", pricingSchema);
export const getCompany = (): Promise<CompanySettings> => read("company", companySchema);
export const getContent = (): Promise<ContentOverrides> => read("content", contentSchema);
