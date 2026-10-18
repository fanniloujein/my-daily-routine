import type { Metadata } from "next";
import { Configurator } from "@/components/configurator/Configurator";
import { isLocale, type Locale } from "@/i18n";
import { getSiteDict } from "@/server/site";
import { getServices } from "@/server/catalog";
import { getPricing } from "@/server/settings";
import { getSessionUser } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = await getSiteDict(isLocale(locale) ? locale : "fr");
  return { title: d.configurator.title, alternates: { canonical: `/${locale}/configurateur` } };
}

export default async function ConfiguratorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { locale: raw } = await params;
  const { service } = await searchParams;
  const locale = (isLocale(raw) ? raw : "fr") as Locale;
  const [d, services, pricing, user] = await Promise.all([getSiteDict(locale), getServices({ activeOnly: true }), getPricing(), getSessionUser()]);
  return (
    <div className="min-h-[70vh] bg-paper-2/60">
      <Configurator locale={locale} d={d} services={services} pricing={pricing} initialService={service} loggedIn={Boolean(user)} />
    </div>
  );
}
