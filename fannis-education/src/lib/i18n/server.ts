import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, dirOf, isLocale, type AppLocale } from "./config";
import { dictionaries } from "./dict";

export const getLocale = cache(async (): Promise<AppLocale> => {
  const jar = await cookies();
  const v = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
});

export const getI18n = cache(async () => {
  const locale = await getLocale();
  return { locale, dir: dirOf(locale), t: dictionaries[locale] };
});
