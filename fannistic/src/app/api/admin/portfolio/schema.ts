import { z } from "zod";

const l10n = (max: number, required = true) =>
  z.object({ fr: required ? z.string().trim().min(1).max(max) : z.string().trim().max(max), en: z.string().trim().max(max), ar: z.string().trim().max(max) });

export const projectSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,78}$/, "Identifiant d’URL : minuscules, chiffres et tirets."),
  category: z.enum(["web", "logo", "identity", "catalog", "card", "other"]),
  title: l10n(200),
  summary: l10n(400),
  body: l10n(10000, false),
  results: l10n(2000, false).nullable(),
  services: z.array(z.string().max(60)).max(12),
  client: z.string().trim().max(120).nullable(),
  year: z.number().int().min(1990).max(2100).nullable(),
  imageIds: z.array(z.string().max(40)).max(20),
  published: z.boolean(),
  order: z.number().int().min(0).max(10000),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export function normalize(p: ProjectInput) {
  const results = p.results && (p.results.fr || p.results.en || p.results.ar) ? p.results : null;
  return { ...p, results: results ?? undefined, client: p.client || null };
}
