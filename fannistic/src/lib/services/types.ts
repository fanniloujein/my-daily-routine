export const LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export type L10n = Record<Locale, string>;

/** Valeur spéciale « Je ne sais pas, conseillez-moi ». */
export const UNSURE = "__unsure";

export type QuestionType =
  | "single" // cartes radio
  | "multi" // cases à cocher
  | "select" // liste déroulante
  | "text"
  | "textarea"
  | "email"
  | "url"
  | "tel"
  | "note"; // simple information, pas de réponse

export interface QuestionOption {
  value: string;
  label: L10n;
  /** Supplément indicatif (unités monétaires entières). null/absent = aucun. */
  priceMin?: number | null;
  priceMax?: number | null;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: L10n;
  help?: L10n;
  placeholder?: L10n;
  options?: QuestionOption[];
  required?: boolean;
  /** Propose « Je ne sais pas, conseillez-moi ». */
  unsure?: boolean;
  enabled: boolean;
  /** Affichée uniquement si la réponse à `question` contient l'une des valeurs. */
  showIf?: { question: string; anyOf: string[] };
  maxLength?: number;
}

export interface ServiceDef {
  slug: string;
  icon: string;
  active: boolean;
  order: number;
  name: L10n;
  description: L10n;
  baseMin: number | null;
  baseMax: number | null;
  questions: Question[];
}

export type AnswerValue = string | string[];
export type ServiceAnswers = Record<string, AnswerValue>;
export type Answers = Record<string, ServiceAnswers>;

export const tr = (fr: string, en: string, ar: string): L10n => ({ fr, en, ar });

export function pick(l: L10n | undefined | null, locale: Locale): string {
  if (!l) return "";
  return l[locale] || l.fr || "";
}
