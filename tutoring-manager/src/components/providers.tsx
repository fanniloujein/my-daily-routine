"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { OverlayProvider } from "@/components/ui";
import { translator, type Locale, LOCALES } from "@/i18n";

type Theme = "light" | "dark" | "system";
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; locale: Locale; setLocale: (l: Locale) => void; t: ReturnType<typeof translator> };
const AppCtx = createContext<Ctx>({ theme: "system", setTheme: () => {}, locale: "fr", setLocale: () => {}, t: translator("fr") });
export const useApp = () => useContext(AppCtx);

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

export function Providers({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [locale, setLocaleState] = useState<Locale>("fr");
  useEffect(() => {
    setThemeState((read("ftm-theme") as Theme) || "system");
    setLocaleState((read("ftm-locale") as Locale) || "fr");
  }, []);
  useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALES[locale]?.dir ?? "ltr";
  }, [locale]);
  const setTheme = useCallback((t: Theme) => { setThemeState(t); write("ftm-theme", t); }, []);
  const setLocale = useCallback((l: Locale) => { setLocaleState(l); write("ftm-locale", l); }, []);
  return (
    <AppCtx.Provider value={{ theme, setTheme, locale, setLocale, t: translator(locale) }}>
      <SWRConfig value={{ shouldRetryOnError: false }}>
        <OverlayProvider>{children}</OverlayProvider>
      </SWRConfig>
    </AppCtx.Provider>
  );
}

/** Script anti-flash : applique le thème avant l'affichage. */
export const themeScript = `try{var t=localStorage.getItem('ftm-theme')||'system';if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
