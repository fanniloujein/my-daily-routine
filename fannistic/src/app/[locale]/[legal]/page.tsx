import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n";
import { getCompanyCached, getSiteDict } from "@/server/site";
import { legalDoc, type LegalPage } from "@/lib/legal";

const PAGES: LegalPage[] = ["mentions-legales", "confidentialite", "conditions"];

async function load(localeRaw: string, page: string) {
  if (!isLocale(localeRaw) || !PAGES.includes(page as LegalPage)) return null;
  const locale = localeRaw as Locale;
  const [d, company] = await Promise.all([getSiteDict(locale), getCompanyCached()]);
  return { locale, doc: legalDoc(page as LegalPage, locale, company, d.legal.toComplete) };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; legal: string }> }): Promise<Metadata> {
  const { locale, legal } = await params;
  const r = await load(locale, legal);
  return r ? { title: r.doc.title, alternates: { canonical: `/${locale}/${legal}` } } : {};
}

export default async function LegalPageView({ params }: { params: Promise<{ locale: string; legal: string }> }) {
  const { locale, legal } = await params;
  const r = await load(locale, legal);
  if (!r) notFound();
  const { doc } = r;
  return (
    <article className="container-x max-w-3xl py-12 sm:py-16">
      <h1 className="text-3xl sm:text-4xl">{doc.title}</h1>
      {doc.intro && <p className="mt-4 text-lg text-ink-2">{doc.intro}</p>}
      <div className="mt-10 space-y-8">
        {doc.sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg">{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-2 whitespace-pre-line leading-relaxed text-ink-2">{p}</p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
