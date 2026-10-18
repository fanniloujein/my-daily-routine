import Link from "next/link";
import { ArrowRight, Check, Gem, Heart, Layers, MousePointer2, Target } from "lucide-react";
import { HeroArt } from "@/components/site/HeroArt";
import { ServiceIcon } from "@/components/site/ServiceIcon";
import { Faq } from "@/components/site/Faq";
import { PortfolioGrid } from "@/components/site/PortfolioGrid";
import { isLocale, type Locale } from "@/i18n";
import { getSiteDict } from "@/server/site";
import { getFaq, getPortfolio, getServices, PORTFOLIO_CATEGORIES } from "@/server/catalog";
import { pick } from "@/lib/services/types";

const WHY_ICONS = [Heart, MousePointer2, Target, Layers, Gem];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "fr") as Locale;
  const [d, services, faq, portfolio] = await Promise.all([
    getSiteDict(locale),
    getServices({ activeOnly: true }),
    getFaq({ publishedOnly: true }),
    getPortfolio({ publishedOnly: true }),
  ]);
  const h = d.home;
  const cards = portfolio.slice(0, 6).map((p) => ({
    slug: p.slug,
    category: p.category,
    title: p.title,
    summary: p.summary,
    cover: p.imageIds[0] ? `/api/files/${p.imageIds[0]}` : null,
  }));

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[linear-gradient(180deg,#F4F6FA_0%,#FFFFFF_100%)]" aria-hidden="true" />
        <div className="container-x grid items-center gap-12 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div className="animate-fade-up">
            <p className="eyebrow inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-sm bg-gold" aria-hidden="true" />
              {h.heroEyebrow}
            </p>
            <h1 className="mt-5 text-[2.35rem] leading-[1.08] sm:text-5xl lg:text-[3.4rem]">{h.heroTitle}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">{h.heroSubtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={`/${locale}/configurateur`} className="btn-primary px-6 py-3.5 text-[15px]">
                {h.heroCta}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
              <Link href={`/${locale}/realisations`} className="btn-ghost px-6 py-3.5 text-[15px]">
                {h.heroCta2}
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
              {h.heroPoints.map((p) => (
                <li key={p} className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-deep" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <HeroArt />
        </div>
      </section>

      {/* Services */}
      <section id="services" className="bg-paper-2 py-20 sm:py-24">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="eyebrow">{d.nav.services}</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">{h.servicesTitle}</h2>
            <p className="mt-4 text-lg text-ink-2">{h.servicesSubtitle}</p>
          </div>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <li key={s.slug} className="card group flex flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-pop">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-midnight text-gold-sun transition group-hover:bg-gold group-hover:text-midnight">
                  <ServiceIcon name={s.icon} className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg">{pick(s.name, locale)}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-2">{pick(s.description, locale)}</p>
                <Link
                  href={`/${locale}/configurateur?service=${s.slug}`}
                  className="mt-6 inline-flex items-center gap-1.5 self-start rounded-full text-sm font-semibold text-ink underline-offset-4 hover:underline"
                  aria-label={`${h.chooseService} : ${pick(s.name, locale)}`}
                >
                  {h.chooseService}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Votre idée, notre création */}
      <section className="py-20 sm:py-24">
        <div className="container-x">
          <div className="relative overflow-hidden rounded-[2rem] bg-midnight px-6 py-14 text-center text-white sm:px-12 sm:py-20">
            <div className="pixel-grid absolute inset-0" aria-hidden="true" />
            <div className="absolute -top-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-cyan/20 blur-3xl" aria-hidden="true" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl text-white sm:text-[2.6rem] sm:leading-tight">{h.ideaTitle}</h2>
              <p className="mt-5 text-lg text-white/75">{h.ideaSubtitle}</p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href={`/${locale}/configurateur`} className="btn-primary px-6 py-3.5 text-[15px]">
                  {h.ideaCta}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
                <Link href={`/${locale}/realisations`} className="btn-ghost-dark px-6 py-3.5 text-[15px]">
                  {h.ideaCta2}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment" className="pb-20 sm:pb-24">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="eyebrow">{d.nav.how}</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">{h.howTitle}</h2>
          </div>
          <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {h.howSteps.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-line bg-white p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-soft text-sm font-bold text-midnight" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-base">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Portfolio */}
      <section id="realisations" className="bg-paper-2 py-20 sm:py-24">
        <div className="container-x">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="eyebrow">{d.nav.portfolio}</p>
              <h2 className="mt-3 text-3xl sm:text-4xl">{h.portfolioTitle}</h2>
              <p className="mt-4 text-lg text-ink-2">{h.portfolioSubtitle}</p>
            </div>
            {cards.length > 0 && (
              <Link href={`/${locale}/realisations`} className="btn-ghost self-start sm:self-auto">
                {h.portfolioSeeAll}
              </Link>
            )}
          </div>
          <div className="mt-10">
            {cards.length > 0 ? (
              <PortfolioGrid items={cards} locale={locale} d={d} categories={[...PORTFOLIO_CATEGORIES]} />
            ) : (
              <div className="rounded-2xl border border-dashed border-ink/20 bg-white px-6 py-14 text-center">
                <h3 className="text-xl">{h.portfolioEmptyTitle}</h3>
                <p className="mx-auto mt-3 max-w-lg text-ink-2">{h.portfolioEmptyText}</p>
                <Link href={`/${locale}/configurateur`} className="btn-dark mt-6">
                  {h.ideaCta}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pourquoi Fanni'stic */}
      <section className="py-20 sm:py-24">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-3xl sm:text-4xl">{h.whyTitle}</h2>
          </div>
          <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {h.whyItems.map((w, i) => {
              const Icon = WHY_ICONS[i % WHY_ICONS.length];
              return (
                <li key={w.title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-soft text-cyan-deep">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-base">{w.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{w.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      {faq.length > 0 && (
        <section id="faq" className="bg-paper-2 py-20 sm:py-24">
          <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <p className="eyebrow">{d.nav.faq}</p>
              <h2 className="mt-3 text-3xl sm:text-4xl">{h.faqTitle}</h2>
              <p className="mt-4 text-ink-2">{h.faqSubtitle}</p>
            </div>
            <Faq items={faq} locale={locale} />
          </div>
        </section>
      )}

      {/* Appel à l'action final */}
      <section className="py-20 sm:py-24">
        <div className="container-x">
          <div className="flex flex-col items-start justify-between gap-8 rounded-[2rem] bg-gold-sun px-6 py-12 sm:px-12 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h2 className="text-3xl text-midnight sm:text-4xl">{h.finalTitle}</h2>
              <p className="mt-3 text-midnight/75">{h.finalText}</p>
            </div>
            <Link href={`/${locale}/configurateur`} className="btn-dark shrink-0 px-7 py-4 text-[15px]">
              {h.finalCta}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
