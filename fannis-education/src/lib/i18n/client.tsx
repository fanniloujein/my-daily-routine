"use client";
import { createContext, useContext } from "react";
import type { AppLocale } from "./config";
import type { Dict } from "./dict";

const I18nContext = createContext<{ locale: AppLocale; t: Dict } | null>(null);

export function I18nProvider({ locale, t, children }: { locale: AppLocale; t: Dict; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n doit être utilisé dans I18nProvider");
  return ctx;
}

/** Traduit un code d'erreur renvoyé par le serveur ou par Zod. */
export function useErrorText() {
  const { t } = useI18n();
  return (code?: string) => {
    if (!code) return undefined;
    return (t.errors as Record<string, string>)[code] ?? t.errors.generic;
  };
}
