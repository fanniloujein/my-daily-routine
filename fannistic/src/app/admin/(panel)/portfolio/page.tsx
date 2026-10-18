/* eslint-disable @next/next/no-img-element -- miniatures d'administration */
import Link from "next/link";
import { Plus } from "lucide-react";
import { getPortfolio } from "@/server/catalog";
import { getDict } from "@/i18n";

export const metadata = { title: "Réalisations" };
const fr = getDict("fr");

export default async function PortfolioAdmin() {
  const projects = await getPortfolio();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl">Réalisations</h1>
          <p className="mt-1 text-sm text-ink-muted">Uniquement des projets réels. Tant qu’aucun projet n’est publié, le site affiche une section d’attente.</p>
        </div>
        <Link href="/admin/portfolio/nouveau" className="btn-primary btn-sm"><Plus className="h-4 w-4" aria-hidden="true" /> Nouveau projet</Link>
      </div>
      {projects.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/portfolio/${p.id}`} className="card block overflow-hidden transition hover:shadow-pop">
                <div className="aspect-[4/3] bg-paper-2">
                  {p.imageIds[0] && <img src={`/api/files/${p.imageIds[0]}`} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-ink-muted">{fr.categories[p.category]}</span>
                    <span className={`badge ${p.published ? "bg-success-soft text-success" : "bg-paper-3 text-ink-muted"}`}>{p.published ? "Publié" : "Brouillon"}</span>
                  </div>
                  <p className="mt-1 font-medium">{p.title.fr}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card p-8 text-center text-ink-muted">Aucun projet pour l’instant.</p>
      )}
    </div>
  );
}
