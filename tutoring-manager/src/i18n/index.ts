// Architecture multilingue : le français est la langue principale.
// Pour ajouter une langue, compléter le dictionnaire correspondant (les clés manquantes retombent sur le français).
import { fr } from "./fr";
import { en } from "./en";
import { ar } from "./ar";

export type Locale = "fr" | "en" | "ar";
export type Messages = typeof fr;
export const LOCALES: Record<Locale, { label: string; dir: "ltr" | "rtl"; dict: Partial<Messages> }> = {
  fr: { label: "Français", dir: "ltr", dict: fr },
  en: { label: "English (partiel)", dir: "ltr", dict: en },
  ar: { label: "العربية (partiel)", dir: "rtl", dict: ar },
};

export function translator(locale: Locale) {
  const dict = LOCALES[locale]?.dict ?? fr;
  return (key: keyof Messages) => dict[key] ?? fr[key];
}
