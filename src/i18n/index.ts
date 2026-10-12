import { fr, type DictKey } from "./fr";
import { en } from "./en";

// Architecture prête pour l'arabe (RTL), l'anglais et l'allemand :
// ajouter un fichier de dictionnaire et l'enregistrer ci-dessous.
export const LOCALES = {
  fr: { label: "Français", dir: "ltr", dict: fr, available: true },
  en: { label: "English", dir: "ltr", dict: en, available: false },
  de: { label: "Deutsch", dir: "ltr", dict: {}, available: false },
  ar: { label: "العربية", dir: "rtl", dict: {}, available: false },
} as const;

export type Locale = keyof typeof LOCALES;

export function translate(locale: Locale, key: DictKey): string {
  const d = LOCALES[locale]?.dict as Partial<Record<DictKey, string>>;
  return d?.[key] ?? fr[key] ?? key;
}

export type { DictKey };
