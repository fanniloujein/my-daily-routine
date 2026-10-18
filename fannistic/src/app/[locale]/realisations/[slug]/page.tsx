import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { prisma } from "@/server/db";
import { getSiteDict } from "@/server/site";
import { getServices, toProject } from "@/server/catalog";
import { isLocale, type Dict, type Locale } from "@/i18n";
import { pick } from "@/lib/services/types";

async function load(slug: string) {
  const row = await prisma.portfolioProject.findUnique({ where: { slug } });
  return row?.published ? toProject(row) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await load(slug);
  if (!p || !isLocale(locale)) return {};
  return {
    title: pick(p.title, locale),
    description: pick(p.summary, locale),
    alternates: { canonical: `/${locale}/realisations/${slug}` },
    openGraph: { images: p.imageIds[0] ? [`/api/files/${p.imageIds[0]}`] : undefined },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const locale = (isLocale(raw) ? raw : "fr") as Locale;
  const p = await load(slug);
  if (!p) notFound();
  const [d, services] = await Promise.all([getSiteDict(locale), getServices()]);
  const results = p.results ? pick(p.results, locale) : "";
  return (
    <article className="container-x py-10 sm:py-14">
      <Link href={`/${locale}/realisations`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {d.portfolio.back}
      </Link>
      <header className="mt-6 max-w-3xl">
        <p className="eyebrow">{d.categories[p.category as keyof Dict["categories"]]}</p>
        <h1 className="mt-3 text-3xl sm:text-5xl">{pick(p.title, locale)}</h1>
        <p className="mt-5 text-lg text-ink-2">{pick(p.summary, locale)}</p>
      </header>

      <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y border-line py-5 text-sm">
        {p.client && (
          <div><dt className="text-ink-muted">{d.portfolio.client}</dt><dd className="mt-1 font-medium">{p.client}</dd></div>
        )}
        {p.year && (
          <div><dt className="text-ink-muted">{d.portfolio.year}</dt><dd className="mt-1 font-medium">{p.year}</dd></div>
        )}
        {p.services.length > 0 && (
          <div>
            <dt className="text-ink-muted">{d.portfolio.services}</dt>
            <dd className="mt-1 font-medium">{p.services.map((s) => pick(services.find((x) => x.slug === s)?.name, locale) || s).join(" · ")}</dd>
          </div>
        )}
      </dl>

      {p.imageIds[0] && (
        <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-3xl bg-paper-2">
          <Image src={`/api/files/${p.imageIds[0]}`} alt={pick(p.title, locale)} fill priority sizes="(min-width:1152px) 1152px, 100vw" className="object-cover" />
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="whitespace-pre-line text-[17px] leading-relaxed text-ink-2">{pick(p.body, locale)}</div>
        {results && (
          <aside className="h-fit rounded-2xl bg-midnight p-6 text-white">
            <h2 className="text-base text-gold-sun">{d.portfolio.results}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/80">{results}</p>
          </aside>
        )}
      </div>

      {p.imageIds.length > 1 && (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {p.imageIds.slice(1).map((id, i) => (
            <li key={id} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-paper-2">
              <Image src={`/api/files/${id}`} alt={`${pick(p.title, locale)} — ${i + 2}`} fill sizes="(min-width:640px) 50vw, 100vw" className="object-cover" />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-14 flex flex-col items-start justify-between gap-4 rounded-2xl bg-paper-2 p-6 sm:flex-row sm:items-center">
        <p className="text-lg font-semibold">{d.portfolio.cta}</p>
        <Link href={`/${locale}/configurateur`} className="btn-primary">
          {d.nav.start} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
