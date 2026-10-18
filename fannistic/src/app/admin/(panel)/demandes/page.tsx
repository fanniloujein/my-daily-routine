import Link from "next/link";
import type { Prisma, RequestStatus } from "@prisma/client";
import { Search } from "lucide-react";
import { prisma } from "@/server/db";
import { getServices } from "@/server/catalog";
import { formatDate, formatMoney, getDict } from "@/i18n";
import { StatusBadge } from "@/components/tracking/StatusBadge";

export const metadata = { title: "Demandes" };

const fr = getDict("fr");
const PAGE_SIZE = 25;
const STATUSES = Object.keys(fr.status) as RequestStatus[];

type Search = { q?: string; status?: string; service?: string; from?: string; to?: string; kind?: string; page?: string };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const services = await getServices();
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ProjectRequestWhereInput = {};
  const q = sp.q?.trim();
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
    ];
  }
  if (sp.status && STATUSES.includes(sp.status as RequestStatus)) where.status = sp.status as RequestStatus;
  if (sp.service) where.services = { has: sp.service };
  if (sp.kind === "QUOTE" || sp.kind === "CALL") where.kind = sp.kind;
  const from = sp.from ? new Date(sp.from) : null;
  const to = sp.to ? new Date(`${sp.to}T23:59:59`) : null;
  if ((from && !isNaN(+from)) || (to && !isNaN(+to))) {
    where.createdAt = { ...(from && !isNaN(+from) ? { gte: from } : {}), ...(to && !isNaN(+to) ? { lte: to } : {}) };
  }

  const [count, rows] = await Promise.all([
    prisma.projectRequest.count({ where }),
    prisma.projectRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        reference: true, name: true, email: true, company: true, status: true, kind: true, services: true,
        createdAt: true, estimateMin: true, estimateMax: true, currency: true, _count: { select: { files: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const name = (slug: string) => services.find((s) => s.slug === slug)?.name.fr ?? slug;
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `?${u}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl">Demandes</h1>
          <p className="mt-1 text-sm text-ink-muted">{count} résultat{count > 1 ? "s" : ""}</p>
        </div>
      </div>

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <div className="relative lg:col-span-2">
          <label htmlFor="q" className="sr-only">Rechercher</label>
          <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-ink-muted" aria-hidden="true" />
          <input id="q" name="q" defaultValue={sp.q} placeholder="Référence, nom, e-mail, entreprise…" className="input ps-9" />
        </div>
        <div>
          <label htmlFor="status" className="sr-only">Statut</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">Tous les statuts</option>
            {STATUSES.map((s) => <option key={s} value={s}>{fr.status[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="service" className="sr-only">Service</label>
          <select id="service" name="service" defaultValue={sp.service ?? ""} className="input">
            <option value="">Tous les services</option>
            {services.map((s) => <option key={s.slug} value={s.slug}>{s.name.fr}</option>)}
          </select>
        </div>
        <div className="flex gap-2 lg:col-span-2">
          <label className="sr-only" htmlFor="from">Du</label>
          <input id="from" type="date" name="from" defaultValue={sp.from} className="input" aria-label="Date de début" />
          <label className="sr-only" htmlFor="to">Au</label>
          <input id="to" type="date" name="to" defaultValue={sp.to} className="input" aria-label="Date de fin" />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <select name="kind" defaultValue={sp.kind ?? ""} className="input max-w-[220px]" aria-label="Type de demande">
            <option value="">Devis et échanges</option>
            <option value="QUOTE">Demandes de devis</option>
            <option value="CALL">Demandes d’échange</option>
          </select>
          <button type="submit" className="btn-dark">Filtrer</button>
          <Link href="/admin/demandes" className="btn-ghost">Réinitialiser</Link>
        </div>
      </form>

      {rows.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line bg-paper-2/60 text-xs text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">Demande</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Client</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Services</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Estimation</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.reference} className="hover:bg-paper-2/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/demandes/${r.reference}`} className="font-mono font-semibold underline-offset-2 hover:underline">{r.reference}</Link>
                    <p className="text-xs text-ink-muted">{formatDate(r.createdAt, "fr", true)} · {r.kind === "CALL" ? "Échange" : "Devis"}{r._count.files ? ` · ${r._count.files} fichier(s)` : ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-ink-muted">{r.company ? `${r.company} · ` : ""}{r.email}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{r.services.map(name).join(", ")}</td>
                  <td className="px-4 py-3 text-ink-2">
                    {r.estimateMin != null && r.estimateMax != null ? `${formatMoney(r.estimateMin, r.currency, "fr")} – ${formatMoney(r.estimateMax, r.currency, "fr")}` : "Sur devis"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} label={fr.status[r.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="card p-8 text-center text-ink-muted">Aucune demande ne correspond à ces critères.</p>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
          {page > 1 && <Link href={qs(page - 1)} className="btn-ghost btn-sm">Précédent</Link>}
          <span className="text-sm text-ink-muted">Page {page} / {pages}</span>
          {page < pages && <Link href={qs(page + 1)} className="btn-ghost btn-sm">Suivant</Link>}
        </nav>
      )}
    </div>
  );
}
