"use client";

/* eslint-disable @next/next/no-img-element -- aperçus d'administration servis par l'API */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from "lucide-react";
import { api } from "./api";
import { L10nField, StatusLine, Toggle, useStatus } from "./ui";

type L = { fr: string; en: string; ar: string };

export interface ProjectForm {
  id?: string;
  slug: string;
  category: string;
  title: L;
  summary: L;
  body: L;
  results: L | null;
  services: string[];
  client: string | null;
  year: number | null;
  imageIds: string[];
  published: boolean;
  order: number;
}

const CATEGORIES = [
  ["web", "Site web"],
  ["logo", "Logo"],
  ["identity", "Identité visuelle"],
  ["catalog", "Catalogue"],
  ["card", "Carte de visite"],
  ["other", "Autre création"],
];

const slugify = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

export function PortfolioEditor({ initial, services }: { initial: ProjectForm; services: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [p, setP] = useState<ProjectForm>(initial);
  const st = useStatus();
  const up = useStatus();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      const form = new FormData();
      form.set("file", f);
      const ok = await up.run(async () => {
        const r = await api<{ id: string }>("/api/admin/uploads", "POST", form);
        setP((x) => ({ ...x, imageIds: [...x.imageIds, r.id] }));
      }, "Image ajoutée");
      if (!ok) break;
    }
  };

  const save = () =>
    st.run(async () => {
      const body = { ...p, slug: p.slug || slugify(p.title.fr), results: p.results };
      delete (body as { id?: string }).id;
      if (p.id) await api(`/api/admin/portfolio/${p.id}`, "PUT", body);
      else {
        const r = await api<{ id: string }>("/api/admin/portfolio", "POST", body);
        router.replace(`/admin/portfolio/${r.id}`);
      }
      router.refresh();
    });

  return (
    <div className="space-y-6 pb-24">
      <section className="card space-y-5 p-5">
        <div className="flex flex-wrap gap-6">
          <Toggle checked={p.published} onChange={(v) => setP({ ...p, published: v })} label="Publié sur le site" />
        </div>
        <L10nField label="Titre" required value={p.title} onChange={(v) => setP({ ...p, title: v })} />
        <L10nField label="Résumé" required multiline value={p.summary} onChange={(v) => setP({ ...p, summary: v })} />
        <L10nField label="Description détaillée" multiline value={p.body} onChange={(v) => setP({ ...p, body: v })} />
        <L10nField
          label="Résultats (uniquement s’ils sont vérifiables)"
          multiline
          value={p.results ?? undefined}
          onChange={(v) => setP({ ...p, results: v })}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="pf-cat" className="field-label">Catégorie</label>
            <select id="pf-cat" className="input" value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })}>
              {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pf-client" className="field-label">Client (avec son accord)</label>
            <input id="pf-client" className="input" value={p.client ?? ""} onChange={(e) => setP({ ...p, client: e.target.value || null })} />
          </div>
          <div>
            <label htmlFor="pf-year" className="field-label">Année</label>
            <input id="pf-year" type="number" className="input" value={p.year ?? ""} onChange={(e) => setP({ ...p, year: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label htmlFor="pf-order" className="field-label">Ordre</label>
            <input id="pf-order" type="number" min={0} className="input" value={p.order} onChange={(e) => setP({ ...p, order: Number(e.target.value) || 0 })} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pf-slug" className="field-label">Adresse de la page</label>
            <div className="flex items-center gap-1 text-sm text-ink-muted">
              <span>/realisations/</span>
              <input id="pf-slug" className="input font-mono text-sm" placeholder={slugify(p.title.fr)} value={p.slug} onChange={(e) => setP({ ...p, slug: slugify(e.target.value) })} />
            </div>
          </div>
        </div>
        <fieldset>
          <legend className="field-label">Services réalisés</legend>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => {
              const on = p.services.includes(s.slug);
              return (
                <label key={s.slug} className={`chip ${on ? "chip-on" : ""}`}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => setP({ ...p, services: on ? p.services.filter((x) => x !== s.slug) : [...p.services, s.slug] })} />
                  {s.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base">Images</h2>
            <p className="text-xs text-ink-muted">La première image sert de couverture. PNG, JPEG, WebP ou GIF, 5 Mo max.</p>
          </div>
          <label className="btn-ghost btn-sm cursor-pointer">
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> Ajouter des images
            <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        <StatusLine status={up.status} />
        {p.imageIds.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {p.imageIds.map((id, i) => (
              <li key={id} className="group relative overflow-hidden rounded-xl border border-line bg-paper-2">
                <img src={`/api/files/${id}`} alt={`Image ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                {i === 0 && <span className="badge absolute start-2 top-2 bg-midnight text-white">Couverture</span>}
                <div className="flex justify-between bg-white p-1">
                  <button type="button" className="rounded p-1 hover:bg-paper-2 disabled:opacity-30" disabled={i === 0} aria-label="Déplacer avant" onClick={() => { const a = [...p.imageIds]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setP({ ...p, imageIds: a }); }}>
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button type="button" className="rounded p-1 text-ink-muted hover:text-danger" aria-label="Retirer l’image" onClick={() => setP({ ...p, imageIds: p.imageIds.filter((x) => x !== id) })}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button type="button" className="rounded p-1 hover:bg-paper-2 disabled:opacity-30" disabled={i === p.imageIds.length - 1} aria-label="Déplacer après" onClick={() => { const a = [...p.imageIds]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; setP({ ...p, imageIds: a }); }}>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:start-64">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <StatusLine status={st.status} />
          <div className="ms-auto flex gap-2">
            {p.id && (
              <button
                type="button"
                className="btn-ghost btn-sm text-danger"
                onClick={async () => {
                  if (!window.confirm("Supprimer ce projet et ses images ?")) return;
                  await api(`/api/admin/portfolio/${p.id}`, "DELETE");
                  router.push("/admin/portfolio");
                  router.refresh();
                }}
              >
                Supprimer
              </button>
            )}
            <button type="button" className="btn-primary btn-sm" disabled={st.busy} onClick={save}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
