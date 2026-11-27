export const LOCALES = ["fr", "ar"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "fr";
export const LOCALE_COOKIE = "fe_locale";

export function isLocale(v: unknown): v is AppLocale {
  return v === "fr" || v === "ar";
}

export function dirOf(locale: AppLocale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Remplace {cle} par la valeur correspondante. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Choisit le libellé dans la langue courante, avec repli sur le français. */
export function localized(locale: AppLocale, fr: string, ar?: string | null): string {
  return locale === "ar" && ar ? ar : fr;
}
