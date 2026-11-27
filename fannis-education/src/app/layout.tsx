import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getI18n } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { Toaster } from "@/components/client/Toaster";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: `${t.common.appName} — ${t.common.tagline}`, template: `%s · ${t.common.appName}` },
    description: t.landing.heroSubtitle,
    metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir, t } = await getI18n();
  return (
    <html lang={locale} dir={dir}>
      <body>
        <I18nProvider locale={locale} t={t}>
          <Toaster>{children}</Toaster>
        </I18nProvider>
      </body>
    </html>
  );
}
