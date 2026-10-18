import { z } from "zod";

const l10n = (max: number) => z.object({ fr: z.string().trim().min(1).max(max), en: z.string().trim().max(max), ar: z.string().trim().max(max) });

export const faqSchema = z.object({ question: l10n(300), answer: l10n(3000), order: z.number().int().min(0).max(1000), published: z.boolean() });
