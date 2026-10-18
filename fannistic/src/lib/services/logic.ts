import { UNSURE, type AnswerValue, type Answers, type Question, type ServiceAnswers, type ServiceDef } from "./types";

export type FieldError = "required" | "invalid" | "tooLong" | "email" | "url" | "tel";

const DEFAULT_MAX = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEL_RE = /^[+0-9 ().-]{6,40}$/;

export function isEmail(v: string) {
  return EMAIL_RE.test(v);
}

export function isUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function asArray(v: AnswerValue | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : v ? [v] : [];
}

export function isVisible(q: Question, answers: ServiceAnswers): boolean {
  if (!q.enabled) return false;
  if (!q.showIf) return true;
  const current = asArray(answers[q.showIf.question]);
  return q.showIf.anyOf.some((v) => current.includes(v));
}

export function visibleQuestions(def: ServiceDef, answers: ServiceAnswers): Question[] {
  return def.questions.filter((q) => isVisible(q, answers));
}

function isAnswerable(q: Question) {
  return q.type !== "note";
}

/**
 * Valide et nettoie les réponses d'un service : ignore les questions inconnues,
 * masquées ou désactivées, refuse les valeurs hors liste.
 */
export function validateServiceAnswers(
  def: ServiceDef,
  raw: unknown,
): { value: ServiceAnswers; errors: Record<string, FieldError> } {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const value: ServiceAnswers = {};
  const errors: Record<string, FieldError> = {};

  // Première passe : on lit les valeurs brutes valides, pour pouvoir évaluer les conditions d'affichage.
  for (const q of def.questions) {
    if (!q.enabled || !isAnswerable(q)) continue;
    const r = input[q.id];
    const allowed = new Set((q.options ?? []).map((o) => o.value));
    if (q.unsure) allowed.add(UNSURE);

    if (q.type === "multi") {
      if (r === undefined || r === null || r === "") continue;
      if (!Array.isArray(r) || !r.every((x) => typeof x === "string" && allowed.has(x))) {
        errors[q.id] = "invalid";
        continue;
      }
      const uniq = [...new Set(r as string[])];
      if (uniq.includes(UNSURE) && uniq.length > 1) {
        errors[q.id] = "invalid";
        continue;
      }
      if (uniq.length) value[q.id] = uniq;
    } else if (q.type === "single" || q.type === "select") {
      if (r === undefined || r === null || r === "") continue;
      if (typeof r !== "string" || !allowed.has(r)) {
        errors[q.id] = "invalid";
        continue;
      }
      value[q.id] = r;
    } else {
      if (r === undefined || r === null) continue;
      if (typeof r !== "string") {
        errors[q.id] = "invalid";
        continue;
      }
      const s = r.trim();
      if (!s) continue;
      if (q.unsure && s === UNSURE) {
        value[q.id] = UNSURE;
        continue;
      }
      if (s.length > (q.maxLength ?? DEFAULT_MAX)) errors[q.id] = "tooLong";
      else if (q.type === "email" && !isEmail(s)) errors[q.id] = "email";
      else if (q.type === "url" && !isUrl(s)) errors[q.id] = "url";
      else if (q.type === "tel" && !TEL_RE.test(s)) errors[q.id] = "tel";
      else value[q.id] = s;
    }
  }

  // Seconde passe : on retire les réponses des questions masquées et on contrôle les champs obligatoires.
  for (const q of def.questions) {
    if (!q.enabled || !isAnswerable(q)) continue;
    if (!isVisible(q, value)) {
      delete value[q.id];
      delete errors[q.id];
      continue;
    }
    if (q.required && !errors[q.id] && asArray(value[q.id]).length === 0) errors[q.id] = "required";
  }

  return { value, errors };
}

export function validateAllAnswers(defs: ServiceDef[], selected: string[], raw: unknown) {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const answers: Answers = {};
  const errors: Record<string, Record<string, FieldError>> = {};
  for (const slug of selected) {
    const def = defs.find((d) => d.slug === slug);
    if (!def) continue;
    const r = validateServiceAnswers(def, input[slug]);
    answers[slug] = r.value;
    if (Object.keys(r.errors).length) errors[slug] = r.errors;
  }
  return { answers, errors };
}

// ── Estimation ───────────────────────────────────────────────────────────

export interface PricingSettings {
  currency: string;
  estimatesEnabled: boolean;
  /** Majoration en % pour un délai urgent. null ou 0 = aucune majoration. */
  urgentSurchargePercent: number | null;
}

export type Estimate =
  | { kind: "range"; min: number; max: number; urgentApplied: boolean }
  | { kind: "custom"; reason: "disabled" | "no-pricing" | "empty" };

const roundTo = (n: number, step = 10) => Math.round(n / step) * step;

export function computeEstimate(
  defs: ServiceDef[],
  selected: string[],
  answers: Answers,
  deadline: string | undefined,
  settings: PricingSettings,
): Estimate {
  if (!settings.estimatesEnabled) return { kind: "custom", reason: "disabled" };
  if (!selected.length) return { kind: "custom", reason: "empty" };
  let min = 0;
  let max = 0;
  for (const slug of selected) {
    const def = defs.find((d) => d.slug === slug);
    // Un seul service sans tarif suffit : afficher une fourchette partielle serait trompeur.
    if (!def || def.baseMin == null || def.baseMax == null) return { kind: "custom", reason: "no-pricing" };
    min += def.baseMin;
    max += def.baseMax;
    const a = answers[slug] ?? {};
    for (const q of visibleQuestions(def, a)) {
      if (!q.options) continue;
      for (const v of asArray(a[q.id])) {
        const opt = q.options.find((o) => o.value === v);
        if (!opt) continue;
        const oMin = opt.priceMin ?? 0;
        const oMax = opt.priceMax ?? opt.priceMin ?? 0;
        min += oMin;
        max += Math.max(oMin, oMax);
      }
    }
  }
  const surcharge = settings.urgentSurchargePercent ?? 0;
  const urgentApplied = deadline === "urgent" && surcharge > 0;
  if (urgentApplied) {
    min *= 1 + surcharge / 100;
    max *= 1 + surcharge / 100;
  }
  return { kind: "range", min: roundTo(min), max: roundTo(Math.max(min, max)), urgentApplied };
}
