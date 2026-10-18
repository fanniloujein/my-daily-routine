import Link from "next/link";
import type { RequestStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { getServices } from "@/server/catalog";
import { isMailConfigured } from "@/server/mail";
import { getDict, formatDate } from "@/i18n";
import { StatusBadge } from "@/components/tracking/StatusBadge";

const fr = getDict("fr");

export default async function AdminDashboard() {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 86_400_000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [total, last30, byStatus, topServices, quoteStats, monthly, recent, services] = await Promise.all([
    prisma.projectRequest.count(),
    prisma.projectRequest.count({ where: { createdAt: { gte: since30 } } }),
    prisma.projectRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.$queryRaw<{ slug: string; n: bigint }[]>`SELECT unnest(services) AS slug, COUNT(*) AS n FROM "ProjectRequest" GROUP BY slug ORDER BY n DESC LIMIT 8`,
    prisma.quote.groupBy({ by: ["status"], _count: { _all: true }, where: { status: { not: "DRAFT" } } }),
    prisma.$queryRaw<{ m: Date; n: bigint }[]>`SELECT date_trunc('month', "createdAt") AS m, COUNT(*) AS n FROM "ProjectRequest" WHERE "createdAt" >= ${sixMonthsAgo} GROUP BY m ORDER BY m`,
    prisma.projectRequest.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { reference: true, name: true, status: true, createdAt: true, services: true } }),
    getServices(),
  ]);

  const statusCount = (s: RequestStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const quotes = Object.fromEntries(quoteStats.map((q) => [q.status, q._count._all])) as Record<string, number>;
  const answered = (quotes.ACCEPTED ?? 0) + (quotes.REJECTED ?? 0);
  const sentTotal = answered + (quotes.SENT ?? 0);
  const name = (slug: string) => services.find((s) => s.slug === slug)?.name.fr ?? slug;

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const row = monthly.find((m) => new Date(m.m).getMonth() === d.getMonth() && new Date(m.m).getFullYear() === d.getFullYear());
    return { label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(d), n: Number(row?.n ?? 0) };
  });
  const maxMonth = Math.max(1, ...months.map((m) => m.n));
  const maxService = Math.max(1, ...topServices.map((s) => Number(s.n)));

  const kpis = [
    { label: "Demandes reçues", value: String(total), hint: "depuis le lancement" },
    { label: "30 derniers jours", value: String(last30), hint: "nouvelles demandes" },
    { label: "À traiter", value: String(statusCount("RECEIVED") + statusCount("INFO_NEEDED")), hint: "reçues ou en attente d’infos" },
    {
      label: "Taux d’acceptation",
      value: answered > 0 ? `${Math.round(((quotes.ACCEPTED ?? 0) / answered) * 100)} %` : "—",
      hint: answered > 0 ? `${quotes.ACCEPTED ?? 0} accepté(s) sur ${answered} devis répondus` : `${sentTotal} devis envoyé(s), aucune réponse encore`,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">Tableau de bord</h1>
        <p className="mt-1 text-sm text-ink-muted">Indicateurs calculés à partir des demandes réellement enregistrées.</p>
      </div>

      {!isMailConfigured() && (
        <p className="rounded-xl border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-midnight">
          Les e-mails ne sont pas configurés : aucune confirmation ni notification n’est envoyée. Voir <Link href="/admin/reglages" className="font-semibold underline">Réglages</Link>.
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <li key={k.label} className="card p-5">
            <p className="text-sm text-ink-muted">{k.label}</p>
            <p className="mt-2 text-3xl font-bold">{k.value}</p>
            <p className="mt-1 text-xs text-ink-muted">{k.hint}</p>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5" aria-labelledby="m-title">
          <h2 id="m-title" className="text-base">Demandes par mois</h2>
          <div className="mt-6 flex h-40 items-end gap-3" role="img" aria-label={months.map((m) => `${m.label} : ${m.n}`).join(", ")}>
            {months.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold text-ink-2">{m.n}</span>
                <div className="w-full rounded-t-md bg-midnight" style={{ height: `${Math.max(4, (m.n / maxMonth) * 110)}px` }} />
                <span className="text-xs text-ink-muted">{m.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5" aria-labelledby="s-title">
          <h2 id="s-title" className="text-base">Services les plus demandés</h2>
          {topServices.length ? (
            <ul className="mt-5 space-y-3">
              {topServices.map((s) => (
                <li key={s.slug}>
                  <div className="flex justify-between text-sm">
                    <span>{name(s.slug)}</span>
                    <span className="font-semibold">{Number(s.n)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-paper-2">
                    <div className="h-2 rounded-full bg-gold" style={{ width: `${(Number(s.n) / maxService) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">Aucune demande pour le moment.</p>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <section className="card p-5" aria-labelledby="st-title">
          <h2 id="st-title" className="text-base">Répartition par statut</h2>
          <ul className="mt-4 space-y-2">
            {(Object.keys(fr.status) as RequestStatus[]).map((s) => (
              <li key={s}>
                <Link href={`/admin/demandes?status=${s}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-paper-2">
                  <StatusBadge status={s} label={fr.status[s]} />
                  <span className="font-semibold">{statusCount(s)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5" aria-labelledby="r-title">
          <div className="flex items-center justify-between">
            <h2 id="r-title" className="text-base">Dernières demandes</h2>
            <Link href="/admin/demandes" className="text-sm font-semibold underline-offset-2 hover:underline">Tout voir</Link>
          </div>
          {recent.length ? (
            <ul className="mt-4 divide-y divide-line">
              {recent.map((r) => (
                <li key={r.reference}>
                  <Link href={`/admin/demandes/${r.reference}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {r.reference} · {r.services.map(name).join(", ")} · {formatDate(r.createdAt, "fr")}
                      </p>
                    </div>
                    <StatusBadge status={r.status} label={fr.status[r.status]} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">Les demandes envoyées depuis le configurateur apparaîtront ici.</p>
          )}
        </section>
      </div>
    </div>
  );
}
