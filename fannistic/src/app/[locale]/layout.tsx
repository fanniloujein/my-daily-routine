import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { LOCALES, isLocale } from "@/i18n";
import { getCompanyCached, getSiteDict } from "@/server/site";
import { getServices } from "@/server/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const d = await getSiteDict(locale);
  return {
    title: { default: d.meta.title, template: "%s · Fanni’stic" },
    description: d.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      type: "website",
      siteName: "Fanni’stic",
      title: d.meta.title,
      description: d.meta.description,
      locale: { fr: "fr_FR", en: "en_GB", ar: "ar_MA" }[locale],
    },
    twitter: { card: "summary_large_image", title: d.meta.title, description: d.meta.description },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [d, company, services] = await Promise.all([getSiteDict(locale), getCompanyCached(), getServices({ activeOnly: true })]);
  return (
    <>
      <Header locale={locale} nav={d.nav} common={d.common} />
      <main id="contenu">{children}</main>
      <Footer locale={locale} d={d} company={company} services={services} />
    </>
  );
}
