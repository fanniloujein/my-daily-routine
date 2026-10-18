"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, User } from "lucide-react";
import { Logo } from "./Logo";
import type { Dict, Locale } from "@/i18n";

const NAMES: Record<Locale, string> = { fr: "FR", en: "EN", ar: "ع" };
const FULL: Record<Locale, string> = { fr: "Français", en: "English", ar: "العربية" };

export function Header({ locale, nav, common }: { locale: Locale; nav: Dict["nav"]; common: Dict["common"] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const swap = (l: Locale) => {
    const rest = pathname.split("/").slice(2).join("/");
    return `/${l}${rest ? `/${rest}` : ""}`;
  };

  const links = [
    { href: `/${locale}#services`, label: nav.services },
    { href: `/${locale}#comment`, label: nav.how },
    { href: `/${locale}/realisations`, label: nav.portfolio },
    { href: `/${locale}#faq`, label: nav.faq },
  ];

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors ${
        scrolled || open ? "border-line bg-white/90 backdrop-blur-md" : "border-transparent bg-white/0"
      }`}
    >
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-midnight focus:px-4 focus:py-2 focus:text-white">
        {common.skip}
      </a>
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href={`/${locale}`} aria-label={`Fanni’stic — ${nav.home}`} className="shrink-0 rounded-lg">
          <Logo />
        </Link>

        <nav aria-label={nav.menu} className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-2 transition hover:bg-paper-2 hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center rounded-full border border-line bg-white p-0.5 sm:flex" role="group" aria-label={common.language}>
            {(Object.keys(NAMES) as Locale[]).map((l) => (
              <Link
                key={l}
                href={swap(l)}
                hrefLang={l}
                lang={l}
                aria-label={FULL[l]}
                aria-current={l === locale ? "true" : undefined}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${l === locale ? "bg-midnight text-white" : "text-ink-2 hover:text-ink"}`}
              >
                {NAMES[l]}
              </Link>
            ))}
          </div>
          <Link href={`/${locale}/espace`} className="btn-ghost btn-sm hidden md:inline-flex">
            <User className="h-4 w-4" aria-hidden="true" />
            {nav.clientArea}
          </Link>
          <Link href={`/${locale}/configurateur`} className="btn-primary btn-sm hidden sm:inline-flex">
            {nav.start}
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? common.close : nav.menu}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-line bg-white lg:hidden">
          <nav aria-label={nav.menu} className="container-x flex flex-col gap-1 py-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-paper-2" onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <Link href={`/${locale}/espace`} className="rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-paper-2">
              {nav.clientArea}
            </Link>
            <div className="mt-2 flex gap-2 px-3" role="group" aria-label={common.language}>
              {(Object.keys(NAMES) as Locale[]).map((l) => (
                <Link key={l} href={swap(l)} lang={l} aria-current={l === locale ? "true" : undefined} className={`chip ${l === locale ? "chip-on" : ""}`}>
                  {FULL[l]}
                </Link>
              ))}
            </div>
            <Link href={`/${locale}/configurateur`} className="btn-primary mt-3">
              {nav.start}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
