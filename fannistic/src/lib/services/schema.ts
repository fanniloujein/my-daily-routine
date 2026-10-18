import { z } from "zod";

/** Validation de la configuration d'un service saisie dans l'administration. */

const l10n = (max = 300, required = true) =>
  z.object({
    fr: required ? z.string().trim().min(1).max(max) : z.string().trim().max(max),
    en: z.string().trim().max(max),
    ar: z.string().trim().max(max),
  });

const slug = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,58}$/, "Identifiant : lettres minuscules, chiffres et tirets.");
const price = z.number().int().min(0).max(10_000_000).nullable().optional();

export const optionSchema = z.object({
  value: z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9+_.-]{0,58}$/, "Valeur d'option invalide."),
  label: l10n(200),
  priceMin: price,
  priceMax: price,
});

export const questionSchema = z
  .object({
    id: z.string().trim().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/, "Identifiant de question invalide."),
    type: z.enum(["single", "multi", "select", "text", "textarea", "email", "url", "tel", "note"]),
    label: l10n(400),
    help: l10n(400, false).optional(),
    placeholder: l10n(200, false).optional(),
    options: z.array(optionSchema).max(40).optional(),
    required: z.boolean().optional(),
    unsure: z.boolean().optional(),
    enabled: z.boolean(),
    showIf: z.object({ question: z.string(), anyOf: z.array(z.string()).min(1) }).nullable().optional(),
    maxLength: z.number().int().min(1).max(10000).optional(),
  })
  .superRefine((q, ctx) => {
    const withOptions = ["single", "multi", "select"].includes(q.type);
    if (withOptions && !(q.options && q.options.length)) ctx.addIssue({ code: "custom", message: `« ${q.label.fr} » : ajoutez au moins une option.` });
    if (q.options) {
      const values = q.options.map((o) => o.value);
      if (new Set(values).size !== values.length) ctx.addIssue({ code: "custom", message: `« ${q.label.fr} » : deux options ont la même valeur.` });
      for (const o of q.options) {
        if (o.priceMin != null && o.priceMax != null && o.priceMax < o.priceMin)
          ctx.addIssue({ code: "custom", message: `« ${o.label.fr} » : le prix maximum est inférieur au minimum.` });
      }
    }
  });

export const serviceSchema = z
  .object({
    slug,
    icon: z.string().max(40),
    active: z.boolean(),
    order: z.number().int().min(0).max(1000),
    name: l10n(120),
    description: l10n(400),
    baseMin: z.number().int().min(0).max(10_000_000).nullable(),
    baseMax: z.number().int().min(0).max(10_000_000).nullable(),
    questions: z.array(questionSchema).max(60),
  })
  .superRefine((s, ctx) => {
    if ((s.baseMin == null) !== (s.baseMax == null)) ctx.addIssue({ code: "custom", message: "Renseignez les deux prix de base (minimum et maximum) ou aucun." });
    if (s.baseMin != null && s.baseMax != null && s.baseMax < s.baseMin) ctx.addIssue({ code: "custom", message: "Le prix de base maximum est inférieur au minimum." });
    const ids = s.questions.map((q) => q.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Deux questions ont le même identifiant." });
    for (const q of s.questions) {
      if (q.showIf && !ids.includes(q.showIf.question)) ctx.addIssue({ code: "custom", message: `« ${q.label.fr} » : la condition d'affichage vise une question inexistante.` });
    }
  });

export type ServiceInput = z.infer<typeof serviceSchema>;

export const firstIssue = (e: z.ZodError) => {
  const i = e.issues[0];
  return i ? (i.code === "custom" || !i.path.length ? i.message : `${i.path.join(" › ")} : ${i.message}`) : "Données invalides.";
};
