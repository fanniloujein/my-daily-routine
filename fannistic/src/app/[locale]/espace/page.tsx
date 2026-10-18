import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/auth";
import { getSiteDict } from "@/server/site";
import { getServices } from "@/server/catalog";
import { fmt, formatDate, isLocale, type Locale } from "@/i18n";
import { pick } from "@/lib/services/types";
import { StatusBadge } from "@/components/tracking/StatusBadge";
import { LogoutButton } from "@/components/account/LogoutButton";

export const metadata: Metadata = { robots: { index: false } };

export default async function ClientArea({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "fr") as Locale;
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/espace/connexion`);
  const [d, services, requests] = await Promise.all([
    getSiteDict(locale),
    getServices(),
    prisma.projectRequest.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { reference: true, status: true, services: true, createdAt: true, updatedAt: true, kind: true },
    }),
  ]);
  const a = d.account;
  const name = (slug: string) => pick(services.find((s) => s.slug === slug)?.name, locale) || slug;

  return (
    <div className="bg-paper-2/60">
      <div className="container-x py-10 sm:py-14">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow">{a.title}</p>
            <h1 className="mt-2 text-3xl">{fmt(a.hello, { name: user.name })}</h1>
          </div>
          <div className="flex gap-2">
            {user.role === "ADMIN" && <Link href="/admin" className="btn-ghost btn-sm">Administration</Link>}
            <LogoutButton label={a.logout} redirectTo={`/${locale}`} />
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between gap-3">
          <h2 className="text-xl">{a.myRequests}</h2>
          <Link href={`/${locale}/configurateur`} className="btn-primary btn-sm">
            <Plus className="h-4 w-4" aria-hidden="true" /> {a.newRequest}
          </Link>
        </div>

        {requests.length ? (
          <ul className="mt-5 grid gap-3">
            {requests.map((r) => (
              <li key={r.reference}>
                <Link href={`/${locale}/suivi/${r.reference}`} className="card flex flex-col gap-3 p-5 transition hover:shadow-pop sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-sm font-semibold" dir="ltr">{r.reference}</p>
                    <p className="mt-1 text-sm text-ink-2">{r.services.map(name).join(" · ")}</p>
                    <p className="mt-1 text-xs text-ink-muted">{fmt(a.updated, { date: formatDate(r.updatedAt, locale) })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={r.status} label={d.status[r.status]} />
                    <ArrowRight className="h-4 w-4 text-ink-muted rtl:rotate-180" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
            <p className="font-medium">{a.empty}</p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-ink-2">{a.emptyHelp}</p>
          </div>
        )}
      </div>
    </div>
  );
}
