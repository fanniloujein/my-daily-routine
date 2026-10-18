"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ImageIcon } from "lucide-react";
import type { Dict, Locale } from "@/i18n";
import { pick, type L10n } from "@/lib/services/types";

export interface PortfolioCard {
  slug: string;
  category: string;
  title: L10n;
  summary: L10n;
  cover: string | null;
}

export function PortfolioGrid({
  items,
  locale,
  d,
  categories,
  filterable = true,
}: {
  items: PortfolioCard[];
  locale: Locale;
  d: Dict;
  categories: string[];
  filterable?: boolean;
}) {
  const [filter, setFilter] = useState<string>("all");
  const present = categories.filter((c) => items.some((i) => i.category === c));
  const shown = filter === "all" ? items : items.filter((i) => i.category === filter);
  const label = (c: string) => d.categories[c as keyof Dict["categories"]] ?? c;

  return (
    <div>
      {filterable && present.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label={d.nav.portfolio}>
          {["all", ...present].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
              className={`chip ${filter === c ? "chip-on" : ""}`}
            >
              {c === "all" ? d.home.portfolioAll : label(c)}
            </button>
          ))}
        </div>
      )}
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <li key={p.slug}>
            <Link href={`/${locale}/realisations/${p.slug}`} className="group card block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
              <div className="relative aspect-[4/3] bg-paper-2">
                {p.cover ? (
                  <Image src={p.cover} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition duration-300 group-hover:scale-[1.02]" />
                ) : (
                  <div className="flex h-full items-center justify-center text-ink-muted">
                    <ImageIcon className="h-8 w-8" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <p className="eyebrow">{label(p.category)}</p>
                <h3 className="mt-2 text-lg">{pick(p.title, locale)}</h3>
                <p className="mt-1.5 line-clamp-2 text-sm text-ink-2">{pick(p.summary, locale)}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                  {d.home.portfolioView} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
