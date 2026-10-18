import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Logo } from "./Logo";
import type { Dict, Locale } from "@/i18n";
import type { CompanySettings } from "@/server/settings";
import { pick, type ServiceDef } from "@/lib/services/types";

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  behance: "Behance",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

export function Footer({ locale, d, company, services }: { locale: Locale; d: Dict; company: CompanySettings; services: ServiceDef[] }) {
  const socials = Object.entries(company.socials).filter(([, url]) => url && /^https?:\/\//.test(url));
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-midnight text-white">
      <div className="pixel-grid absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="container-x relative grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="light" withTagline />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/70">{d.footer.about}</p>
          {(company.email || company.phone) && (
            <ul className="mt-5 space-y-2 text-sm">
              {company.email && (
                <li>
                  <a href={`mailto:${company.email}`} className="inline-flex items-center gap-2 text-white/85 hover:text-gold-sun">
                    <Mail className="h-4 w-4" aria-hidden="true" /> {company.email}
                  </a>
                </li>
              )}
              {company.phone && (
                <li>
                  <a href={`tel:${company.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-white/85 hover:text-gold-sun" dir="ltr">
                    <Phone className="h-4 w-4" aria-hidden="true" /> {company.phone}
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">{d.footer.servicesTitle}</h2>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            {services.slice(0, 6).map((s) => (
              <li key={s.slug}>
                <Link href={`/${locale}/configurateur?service=${s.slug}`} className="hover:text-white">
                  {pick(s.name, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">{d.footer.studioTitle}</h2>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li><Link href={`/${locale}/realisations`} className="hover:text-white">{d.nav.portfolio}</Link></li>
            <li><Link href={`/${locale}#faq`} className="hover:text-white">{d.nav.faq}</Link></li>
            <li><Link href={`/${locale}/configurateur`} className="hover:text-white">{d.footer.contact}</Link></li>
            <li><Link href={`/${locale}/espace`} className="hover:text-white">{d.nav.clientArea}</Link></li>
          </ul>
          {socials.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-semibold text-white">{d.footer.follow}</h2>
              <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {socials.map(([k, url]) => (
                  <li key={k}>
                    <a href={url} rel="noopener noreferrer" target="_blank" className="inline-block rounded-full border border-white/20 px-3 py-1 text-white/80 hover:border-gold-sun hover:text-gold-sun">
                      {SOCIAL_LABELS[k] ?? k}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">{d.footer.legalTitle}</h2>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li><Link href={`/${locale}/mentions-legales`} className="hover:text-white">{d.footer.legal}</Link></li>
            <li><Link href={`/${locale}/confidentialite`} className="hover:text-white">{d.footer.privacy}</Link></li>
            <li><Link href={`/${locale}/conditions`} className="hover:text-white">{d.footer.terms}</Link></li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {company.tradeName || "Fanni’stic"}. {d.footer.rights}</p>
          <p dir="ltr">Design <span className="text-gold">•</span> Web <span className="text-gold">•</span> Branding</p>
        </div>
      </div>
    </footer>
  );
}
