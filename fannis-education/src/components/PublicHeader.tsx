import Link from "next/link";
import { Menu } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/token";
import { LinkButton } from "@/components/ui";
import { Logo } from "./Logo";
import { LocaleSwitcher } from "./client/LocaleSwitcher";

export async function PublicHeader() {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  const links = [
    { href: "/#how", label: t.nav.howItWorks },
    { href: "/#subjects", label: t.nav.subjects },
    { href: "/teachers", label: t.nav.teachers },
    { href: "/#pricing", label: t.nav.pricing },
    { href: "/#faq", label: t.nav.faq },
  ];
  const actions = user ? (
    <LinkButton href={homeForRole(user.role)} size="sm">
      {t.common.dashboard}
    </LinkButton>
  ) : (
    <>
      <LinkButton href="/login" variant="ghost" size="sm">
        {t.common.login}
      </LinkButton>
      <LinkButton href="/register" size="sm">
        {t.common.register}
      </LinkButton>
    </>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-xl px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-1 sm:flex">
          <LocaleSwitcher />
          {actions}
        </div>
        <details className="relative sm:hidden">
          <summary className="list-none rounded-xl p-2 text-ink-soft hover:bg-surface [&::-webkit-details-marker]:hidden" aria-label={t.common.menu}>
            <Menu className="h-5 w-5" />
          </summary>
          <div className="absolute end-0 mt-2 w-64 space-y-1 rounded-2xl border border-gray-100 bg-white p-3 shadow-card">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-xl px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface">
                {l.label}
              </Link>
            ))}
            <div className="border-t border-gray-100 pt-2">
              <LocaleSwitcher className="w-full justify-start" />
            </div>
            <div className="flex flex-col gap-2 pt-1">{actions}</div>
          </div>
        </details>
      </div>
    </header>
  );
}

export async function PublicFooter() {
  const { t } = await getI18n();
  return (
    <footer className="border-t border-gray-100 bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-sm space-y-2">
          <Logo />
          <p className="text-sm text-ink-muted">{t.common.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          <Link href="/teachers" className="hover:text-ink">{t.nav.teachers}</Link>
          <Link href="/#pricing" className="hover:text-ink">{t.nav.pricing}</Link>
          <Link href="/#contact" className="hover:text-ink">{t.nav.contact}</Link>
          <Link href="/register/teacher" className="hover:text-ink">{t.landing.footerTeachers}</Link>
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-ink-muted">
        © {new Date().getFullYear()} Fanni&apos;s Education. {t.landing.footerRights}
      </p>
    </footer>
  );
}
