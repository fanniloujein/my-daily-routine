import "server-only";
import { cache } from "react";
import { getDict, type Dict, type Locale } from "@/i18n";
import { getCompany, getContent, CONTENT_KEYS } from "./settings";

/** Dictionnaire de la langue, avec les textes d'accueil personnalisés par l'administrateur. */
export const getSiteDict = cache(async (locale: Locale): Promise<Dict> => {
  const base = getDict(locale);
  const overrides = (await getContent())[locale] ?? {};
  const home = { ...base.home };
  for (const key of CONTENT_KEYS) {
    const v = overrides[key]?.trim();
    if (v) (home as Record<string, unknown>)[key] = v;
  }
  return { ...base, home };
});

export const getCompanyCached = cache(getCompany);
