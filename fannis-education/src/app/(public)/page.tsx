import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarCheck, CheckCircle2, FolderOpen, LineChart, Mail, Phone, UserPlus, Users, Wallet } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { getActiveLevelsWithSubjects, getActivePlans, listPublicTeachers } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { Badge, Card, EmptyState, LinkButton } from "@/components/ui";
import { Icon } from "@/components/icons";
import { TeacherCard } from "@/components/TeacherCard";
import { ContactForm } from "@/components/client/ContactForm";

export const dynamic = "force-dynamic";

function Section({ id, title, subtitle, children, muted }: { id: string; title: string; subtitle?: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <section id={id} className={muted ? "scroll-mt-20 bg-surface" : "scroll-mt-20"}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

export default async function LandingPage() {
  const { t, locale } = await getI18n();
  const [levels, plans, teachers, settings] = await Promise.all([
    getActiveLevelsWithSubjects(),
    getActivePlans(),
    listPublicTeachers({ take: 3 }),
    getSettings(),
  ]);
  const subjectCount = levels.reduce((n, l) => n + l.subjects.length, 0);
  const cheapest = plans.length ? Math.min(...plans.map((p) => p.priceMillimes)) : null;
  const L = t.landing;

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-sun-100 blur-3xl" aria-hidden />
        <div className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:pb-24 lg:pt-20">
          <div>
            <Badge tone="blue" className="mb-5">{L.badge}</Badge>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{L.heroTitle}</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft">{L.heroSubtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/register" size="lg">
                {L.ctaStart} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
              </LinkButton>
              <LinkButton href="#pricing" variant="secondary" size="lg">{L.ctaPricing}</LinkButton>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              <div>
                <dt className="sr-only">{L.heroStat1}</dt>
                <dd className="text-2xl font-bold text-brand-700">{subjectCount || "—"}</dd>
                <dd className="text-xs text-ink-muted">{L.heroStat1}</dd>
              </div>
              <div>
                <dd className="text-2xl font-bold text-brand-700">{cheapest !== null ? formatMoney(cheapest, locale) : "—"}</dd>
                <dd className="text-xs text-ink-muted">{L.heroStat2}</dd>
              </div>
              <div>
                <dd className="text-2xl font-bold text-brand-700">1:1</dd>
                <dd className="text-xs text-ink-muted">{L.heroStat3}</dd>
              </div>
            </dl>
          </div>

          {/* Illustration de l'interface (décorative) */}
          <div className="relative mx-auto hidden w-full max-w-md sm:block" aria-hidden>
            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Icon name="economy" /></span>
                <div className="flex-1">
                  <div className="h-3 w-32 rounded bg-gray-200" />
                  <div className="mt-2 h-2.5 w-20 rounded bg-gray-100" />
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {[80, 55, 30].map((w, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className={i < 2 ? "h-5 w-5 text-brand-500" : "h-5 w-5 text-gray-200"} />
                    <div className="h-2.5 flex-1 rounded bg-gray-100"><div className="h-full rounded bg-brand-200" style={{ width: `${w}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-8 -start-4 w-56 rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:-start-10">
              <div className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck className="h-4 w-4 text-sun-500" /> <span className="h-2.5 w-24 rounded bg-gray-200" /></div>
              <div className="mt-3 h-2.5 w-36 rounded bg-gray-100" />
              <div className="mt-2 h-2.5 w-28 rounded bg-gray-100" />
            </div>
            <div className="absolute -end-3 -top-6 rounded-2xl bg-sun-200 px-4 py-3 shadow-card">
              <LineChart className="h-6 w-6 text-sun-700" />
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <Section id="how" title={L.howTitle} subtitle={L.howSubtitle}>
        <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            { icon: UserPlus, title: L.how1Title, body: L.how1Body },
            { icon: BookOpenCheck, title: L.how2Title, body: L.how2Body },
            { icon: CalendarCheck, title: L.how3Title, body: L.how3Body },
          ].map((s, i) => (
            <li key={i}>
              <Card className="h-full">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><s.icon className="h-5 w-5" aria-hidden /></span>
                  <span className="text-sm font-semibold text-brand-600">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-ink-muted">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      {/* Matières */}
      <Section id="subjects" title={L.subjectsTitle} subtitle={L.subjectsSubtitle} muted>
        {subjectCount === 0 ? (
          <EmptyState title={L.subjectsEmpty} />
        ) : (
          levels.map((level) => (
            <div key={level.id} className="mb-8 last:mb-0">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-muted">{localized(locale, level.name, level.nameAr)}</h3>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {level.subjects.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-soft">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name={s.icon} className="h-[18px] w-[18px]" /></span>
                    <span className="text-sm font-medium leading-tight">{localized(locale, s.name, s.nameAr)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Section>

      {/* Enseignants */}
      <Section id="teachers" title={L.teachersTitle} subtitle={L.teachersSubtitle}>
        {teachers.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title={L.teachersEmpty} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {teachers.map((tp) => (
                <TeacherCard key={tp.id} teacher={tp} href={`/teachers/${tp.id}`} t={t} locale={locale} />
              ))}
            </div>
            <div className="mt-8">
              <LinkButton href="/teachers" variant="secondary">{L.teachersAll}</LinkButton>
            </div>
          </>
        )}
      </Section>

      {/* Avantages */}
      <Section id="benefits" title={L.benefitsTitle} muted>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FolderOpen, title: L.benefit1Title, body: L.benefit1Body },
            { icon: LineChart, title: L.benefit2Title, body: L.benefit2Body },
            { icon: Users, title: L.benefit3Title, body: L.benefit3Body },
            { icon: Wallet, title: L.benefit4Title, body: L.benefit4Body },
          ].map((b) => (
            <Card key={b.title} className="h-full">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sun-100 text-sun-700"><b.icon className="h-5 w-5" aria-hidden /></span>
              <h3 className="mt-4 font-semibold">{b.title}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{b.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Tarifs */}
      <Section id="pricing" title={L.pricingTitle} subtitle={L.pricingSubtitle}>
        {plans.length === 0 ? (
          <EmptyState title={L.pricingEmpty} />
        ) : (
          <div className="grid grid-cols-1 max-w-4xl gap-5 md:grid-cols-2">
            {plans.map((plan) => {
              const features = (locale === "ar" && Array.isArray(plan.featuresAr) && plan.featuresAr.length ? plan.featuresAr : plan.features) as string[];
              return (
                <div key={plan.id} className={`rounded-3xl border p-6 shadow-card sm:p-8 ${plan.isFeatured ? "border-brand-200 bg-gradient-to-b from-brand-50 to-white" : "border-gray-100 bg-white"}`}>
                  <h3 className="text-lg font-semibold">{localized(locale, plan.name, plan.nameAr)}</h3>
                  {plan.description && <p className="mt-1 text-sm text-ink-muted">{localized(locale, plan.description, plan.descriptionAr)}</p>}
                  <p className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold tracking-tight">{formatMoney(plan.priceMillimes, locale)}</span>
                    <span className="text-ink-muted">{fmt(t.student.subDuration, { days: plan.durationDays })}</span>
                  </p>
                  <ul className="mt-6 space-y-2.5">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-ink-soft">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden /> {f}
                      </li>
                    ))}
                  </ul>
                  <LinkButton href="/register" className="mt-7 w-full">{L.pricingCta}</LinkButton>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-6 max-w-2xl text-sm text-ink-muted">{L.pricingNote}</p>
      </Section>

      {/* Témoignages (démo) */}
      <Section id="testimonials" title={L.testimonialsTitle} muted>
        <p className="-mt-6 mb-8 inline-flex rounded-xl bg-sun-100 px-3 py-2 text-sm text-sun-700">{L.testimonialsDemo}</p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {L.testimonials.map((tm) => (
            <figure key={tm.name} className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
              <Badge tone="yellow" className="absolute end-4 top-4">{t.common.demo}</Badge>
              <blockquote className="pe-10 text-ink-soft">« {tm.quote} »</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold">{tm.name}</span>
                <span className="block text-ink-muted">{tm.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" title={L.faqTitle}>
        <div className="max-w-3xl divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-card">
          {L.faq.map((item) => (
            <details key={item.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="text-xl text-brand-500 transition group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Contact */}
      <Section id="contact" title={L.contactTitle} subtitle={L.contactSubtitle} muted>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3 text-sm">
            {settings.contactEmail && (
              <p className="flex items-center gap-2 text-ink-soft"><Mail className="h-4 w-4 text-brand-500" aria-hidden /> <a href={`mailto:${settings.contactEmail}`} className="hover:text-ink" dir="ltr">{settings.contactEmail}</a></p>
            )}
            {settings.contactPhone && (
              <p className="flex items-center gap-2 text-ink-soft"><Phone className="h-4 w-4 text-brand-500" aria-hidden /> <span dir="ltr">{settings.contactPhone}</span></p>
            )}
            <div className="pt-4">
              <p className="font-medium">{t.auth.areYouTeacher}</p>
              <Link href="/register/teacher" className="text-brand-700 hover:underline">{t.auth.teacherCta}</Link>
            </div>
          </div>
          <Card>
            <ContactForm />
          </Card>
        </div>
      </Section>
    </main>
  );
}
