import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/cairo/arabic-400.css";
import "@fontsource/cairo/arabic-600.css";
import "@fontsource/cairo/arabic-700.css";
import "./globals.css";
import { DEFAULT_LOCALE, dir, isLocale } from "@/i18n";
import { siteUrl } from "@/server/mail";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Fanni’stic", template: "%s · Fanni’stic" },
  applicationName: "Fanni’stic",
};

export const viewport: Viewport = { themeColor: "#0E1633", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // La langue est déterminée par le middleware (préfixe /fr, /en, /ar ; français pour l'administration).
  const h = await headers();
  const raw = h.get("x-locale");
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  return (
    <html lang={locale} dir={dir(locale)}>
      <body>{children}</body>
    </html>
  );
}
