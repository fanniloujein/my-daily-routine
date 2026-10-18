import type { Metadata } from "next";
import Link from "next/link";
import { PortfolioGrid } from "@/components/site/PortfolioGrid";
import { isLocale, type Locale } from "@/i18n";
import { getSiteDict } from "@/server/site";
import { getPortfolio, PORTFOLIO_CATEGORIES } from "@/server/catalog";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = await getSiteDict(isLocale(locale) ? locale : "fr");
  return { title: d.home.portfolioTitle, description: d.home.portfolioSubtitle, alternates: { canonical: `/${locale}/realisations` } };
}

export default async function PortfolioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "fr") as Locale;
  const [d, projects] = await Promise.all([getSiteDict(locale), getPortfolio({ publishedOnly: true })]);
  const h = d.home;
  return (
    <div className="container-x py-12 sm:py-16">
      <p className="eyebrow">{d.nav.portfolio}</p>
      <h1 className="mt-3 text-3xl sm:text-4xl">{h.portfolioTitle}</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-2">{h.portfolioSubtitle}</p>
      <div className="mt-10">
        {projects.length ? (
          <PortfolioGrid
            items={projects.map((p) => ({ slug: p.slug, category: p.category, title: p.title, summary: p.summary, cover: p.imageIds[0] ? `/api/files/${p.imageIds[0]}` : null }))}
            locale={locale}
            d={d}
            categories={[...PORTFOLIO_CATEGORIES]}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-ink/20 bg-paper-2 px-6 py-14 text-center">
            <h2 className="text-xl">{h.portfolioEmptyTitle}</h2>
            <p className="mx-auto mt-3 max-w-lg text-ink-2">{h.portfolioEmptyText}</p>
            <Link href={`/${locale}/configurateur`} className="btn-dark mt-6">{h.ideaCta}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
