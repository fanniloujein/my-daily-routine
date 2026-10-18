import fr, { type Dict } from "./fr";
import en from "./en";
import ar from "./ar";
import { LOCALES, type Locale } from "@/lib/services/types";

export type { Dict };
export { LOCALES, type Locale };

const DICTS: Record<Locale, Dict> = { fr, en, ar };

export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_NAMES: Record<Locale, string> = { fr: "Français", en: "English", ar: "العربية" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function getDict(locale: Locale): Dict {
  return DICTS[locale] ?? fr;
}

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Remplace les {variables} d'un texte traduit. */
export function fmt(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

const INTL: Record<Locale, string> = { fr: "fr-FR", en: "en-GB", ar: "ar-MA" };

export function intlLocale(locale: Locale) {
  return INTL[locale];
}

/** Montant en unités entières (ex. 1500 → « 1 500 € »). */
export function formatMoney(amount: number, currency: string, locale: Locale) {
  try {
    return new Intl.NumberFormat(INTL[locale], { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** Montant en centimes (devis). */
export function formatCents(cents: number, currency: string, locale: Locale) {
  try {
    return new Intl.NumberFormat(INTL[locale], { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDate(d: Date | string, locale: Locale, withTime = false) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(INTL[locale], {
    dateStyle: "long",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

export function formatSize(bytes: number, locale: Locale) {
  const mb = bytes / 1024 / 1024;
  return new Intl.NumberFormat(INTL[locale], { style: "unit", unit: mb < 1 ? "kilobyte" : "megabyte", maximumFractionDigits: 1 }).format(
    mb < 1 ? Math.max(1, Math.round(bytes / 1024)) : mb,
  );
}
