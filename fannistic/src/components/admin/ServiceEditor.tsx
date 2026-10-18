"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { api } from "./api";
import { L10nField, StatusLine, Toggle, useStatus } from "./ui";
import { ServiceIcon, ICON_NAMES } from "@/components/site/ServiceIcon";
import type { Question, QuestionOption, QuestionType, ServiceDef } from "@/lib/services/types";

const TYPES: { value: QuestionType; label: string }[] = [
  { value: "single", label: "Choix unique (cartes)" },
  { value: "multi", label: "Choix multiples (cases à cocher)" },
  { value: "select", label: "Liste déroulante" },
  { value: "text", label: "Texte court" },
  { value: "textarea", label: "Texte long" },
  { value: "email", label: "E-mail" },
  { value: "url", label: "Adresse web" },
  { value: "tel", label: "Téléphone" },
  { value: "note", label: "Information (sans réponse)" },
];
const WITH_OPTIONS: QuestionType[] = ["single", "multi", "select"];
const empty = () => ({ fr: "", en: "", ar: "" });

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

const num = (v: string): number | null => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v)) || 0));

export function ServiceEditor({ initial, currency }: { initial: ServiceDef; currency: string }) {
  const router = useRouter();
  const [s, setS] = useState<ServiceDef>(initial);
  const [open, setOpen] = useState<number | null>(null);
  const st = useStatus();

  const setQ = (i: number, patch: Partial<Question>) => setS({ ...s, questions: s.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const setOpt = (qi: number, oi: number, patch: Partial<QuestionOption>) =>
    setQ(qi, { options: (s.questions[qi].options ?? []).map((o, j) => (j === oi ? { ...o, ...patch } : o)) });

  const save = () =>
    st.run(async () => {
      await api(`/api/admin/services/${s.slug}`, "PUT", s);
      router.refresh();
    });

  return (
    <div className="space-y-6 pb-24">
      <section className="card space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-6">
          <Toggle checked={s.active} onChange={(v) => setS({ ...s, active: v })} label="Visible sur le site" />
          <div className="flex items-center gap-2">
            <label htmlFor="order" className="text-sm">Ordre</label>
            <input id="order" type="number" min={0} className="input w-20" value={s.order} onChange={(e) => setS({ ...s, order: Number(e.target.value) || 0 })} />
          </div>
          <fieldset className="flex flex-wrap items-center gap-1.5">
            <legend className="sr-only">Icône</legend>
            {ICON_NAMES.map((n) => (
              <label key={n} className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border focus-within:ring-2 focus-within:ring-cyan ${s.icon === n ? "border-midnight bg-midnight text-gold-sun" : "border-line bg-white"}`}>
                <input type="radio" name="icon" className="sr-only" checked={s.icon === n} onChange={() => setS({ ...s, icon: n })} aria-label={`Icône ${n}`} />
                <ServiceIcon name={n} className="h-4 w-4" />
              </label>
            ))}
          </fieldset>
        </div>
        <L10nField label="Nom du service" required value={s.name} onChange={(v) => setS({ ...s, name: v })} />
        <L10nField label="Description courte" required multiline value={s.description} onChange={(v) => setS({ ...s, description: v })} />
      </section>

      <section className="card p-5">
        <h2 className="text-base">Prix de base</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Fourchette de départ en {currency}, avant options. Laissez vide pour afficher « Devis personnalisé » : aucune estimation n’est alors montrée pour ce service.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <div>
            <label htmlFor="bmin" className="field-label">Minimum</label>
            <input id="bmin" type="number" min={0} className="input w-36" value={s.baseMin ?? ""} onChange={(e) => setS({ ...s, baseMin: num(e.target.value) })} />
          </div>
          <div>
            <label htmlFor="bmax" className="field-label">Maximum</label>
            <input id="bmax" type="number" min={0} className="input w-36" value={s.baseMax ?? ""} onChange={(e) => setS({ ...s, baseMax: num(e.target.value) })} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg">Questions et filtres ({s.questions.length})</h2>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              const id = `q${Date.now().toString(36)}`;
              setS({ ...s, questions: [...s.questions, { id, type: "single", enabled: true, label: { fr: "Nouvelle question", en: "", ar: "" }, options: [{ value: "option-1", label: { fr: "Option 1", en: "", ar: "" } }] }] });
              setOpen(s.questions.length);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter une question
          </button>
        </div>

        {s.questions.map((q, i) => {
          const isOpen = open === i;
          const others = s.questions.filter((x, j) => j !== i && WITH_OPTIONS.includes(x.type));
          const condQ = q.showIf ? s.questions.find((x) => x.id === q.showIf!.question) : undefined;
          return (
            <div key={i} className={`card ${q.enabled ? "" : "opacity-70"}`}>
              <div className="flex items-center gap-2 p-3">
                <div className="flex flex-col">
                  <button type="button" className="rounded p-0.5 text-ink-muted hover:text-ink disabled:opacity-30" disabled={i === 0} aria-label="Monter" onClick={() => setS({ ...s, questions: move(s.questions, i, -1) })}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="rounded p-0.5 text-ink-muted hover:text-ink disabled:opacity-30" disabled={i === s.questions.length - 1} aria-label="Descendre" onClick={() => setS({ ...s, questions: move(s.questions, i, 1) })}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-start" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{q.label.fr || "(sans titre)"}</span>
                    <span className="block text-xs text-ink-muted">
                      {TYPES.find((t) => t.value === q.type)?.label}
                      {q.required ? " · obligatoire" : ""}
                      {q.showIf ? " · conditionnelle" : ""}
                      {!q.enabled ? " · masquée" : ""}
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
              </div>

              {isOpen && (
                <div className="space-y-4 border-t border-line p-4">
                  <div className="flex flex-wrap gap-5">
                    <Toggle checked={q.enabled} onChange={(v) => setQ(i, { enabled: v })} label="Active" />
                    {q.type !== "note" && <Toggle checked={Boolean(q.required)} onChange={(v) => setQ(i, { required: v })} label="Obligatoire" />}
                    {q.type !== "note" && <Toggle checked={Boolean(q.unsure)} onChange={(v) => setQ(i, { unsure: v })} label="« Je ne sais pas, conseillez-moi »" />}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="field-label" htmlFor={`type-${i}`}>Type de réponse</label>
                      <select
                        id={`type-${i}`}
                        className="input"
                        value={q.type}
                        onChange={(e) => {
                          const type = e.target.value as QuestionType;
                          setQ(i, { type, options: WITH_OPTIONS.includes(type) ? q.options ?? [{ value: "option-1", label: { fr: "Option 1", en: "", ar: "" } }] : q.options });
                        }}
                      >
                        {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="field-label" htmlFor={`id-${i}`}>Identifiant technique</label>
                      <input id={`id-${i}`} className="input font-mono text-sm" value={q.id} onChange={(e) => setQ(i, { id: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} />
                    </div>
                  </div>
                  <L10nField label={q.type === "note" ? "Texte affiché" : "Question"} required value={q.label} onChange={(v) => setQ(i, { label: v })} multiline={q.type === "note"} />
                  {q.type !== "note" && <L10nField label="Aide (facultatif)" value={q.help} onChange={(v) => setQ(i, { help: v })} />}

                  {WITH_OPTIONS.includes(q.type) && (
                    <div>
                      <p className="field-label">Options</p>
                      <p className="field-help mb-2">Supplément de prix facultatif (en {currency}), ajouté à l’estimation lorsque l’option est choisie.</p>
                      <div className="space-y-3">
                        {(q.options ?? []).map((o, oi) => (
                          <div key={oi} className="rounded-xl border border-line p-3">
                            <div className="mb-2 flex flex-wrap items-end gap-2">
                              <div>
                                <label className="text-xs text-ink-muted" htmlFor={`ov-${i}-${oi}`}>Valeur</label>
                                <input id={`ov-${i}-${oi}`} className="input w-36 font-mono text-xs" value={o.value} onChange={(e) => setOpt(i, oi, { value: e.target.value.replace(/[^a-zA-Z0-9+_.-]/g, "") })} />
                              </div>
                              <div>
                                <label className="text-xs text-ink-muted" htmlFor={`pmin-${i}-${oi}`}>+ min</label>
                                <input id={`pmin-${i}-${oi}`} type="number" min={0} className="input w-28" value={o.priceMin ?? ""} onChange={(e) => setOpt(i, oi, { priceMin: num(e.target.value) })} />
                              </div>
                              <div>
                                <label className="text-xs text-ink-muted" htmlFor={`pmax-${i}-${oi}`}>+ max</label>
                                <input id={`pmax-${i}-${oi}`} type="number" min={0} className="input w-28" value={o.priceMax ?? ""} onChange={(e) => setOpt(i, oi, { priceMax: num(e.target.value) })} />
                              </div>
                              <div className="ms-auto flex gap-1">
                                <button type="button" className="rounded p-1.5 text-ink-muted hover:text-ink" aria-label="Monter l’option" onClick={() => setQ(i, { options: move(q.options ?? [], oi, -1) })}><ArrowUp className="h-4 w-4" /></button>
                                <button type="button" className="rounded p-1.5 text-ink-muted hover:text-ink" aria-label="Descendre l’option" onClick={() => setQ(i, { options: move(q.options ?? [], oi, 1) })}><ArrowDown className="h-4 w-4" /></button>
                                <button type="button" className="rounded p-1.5 text-ink-muted hover:text-danger" aria-label="Supprimer l’option" onClick={() => setQ(i, { options: (q.options ?? []).filter((_, j) => j !== oi) })}><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </div>
                            <L10nField label="Libellé" required value={o.label} onChange={(v) => setOpt(i, oi, { label: v })} />
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn-ghost btn-sm mt-2"
                        onClick={() => setQ(i, { options: [...(q.options ?? []), { value: `option-${(q.options?.length ?? 0) + 1}`, label: empty() }] })}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter une option
                      </button>
                    </div>
                  )}

                  {q.type !== "note" && (
                    <div className="rounded-xl bg-paper-2 p-3">
                      <p className="field-label">Affichage conditionnel</p>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span>Afficher seulement si</span>
                        <select
                          className="input w-auto"
                          aria-label="Question de condition"
                          value={q.showIf?.question ?? ""}
                          onChange={(e) => setQ(i, { showIf: e.target.value ? { question: e.target.value, anyOf: [] } : undefined })}
                        >
                          <option value="">— toujours afficher —</option>
                          {others.map((x) => <option key={x.id} value={x.id}>{x.label.fr}</option>)}
                        </select>
                        {condQ && <span>vaut l’une de ces réponses :</span>}
                      </div>
                      {condQ && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(condQ.options ?? []).map((o) => {
                            const on = q.showIf!.anyOf.includes(o.value);
                            return (
                              <label key={o.value} className={`chip text-xs ${on ? "chip-on" : ""}`}>
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={on}
                                  onChange={() => setQ(i, { showIf: { question: condQ.id, anyOf: on ? q.showIf!.anyOf.filter((v) => v !== o.value) : [...q.showIf!.anyOf, o.value] } })}
                                />
                                {o.label.fr}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn-ghost btn-sm text-danger"
                    onClick={() => {
                      if (!window.confirm(`Supprimer la question « ${q.label.fr} » ?`)) return;
                      setS({ ...s, questions: s.questions.filter((_, j) => j !== i) });
                      setOpen(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Supprimer la question
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:start-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <StatusLine status={st.status} />
          <div className="ms-auto flex gap-2">
            <button
              type="button"
              className="btn-ghost btn-sm text-danger"
              onClick={async () => {
                if (!window.confirm(`Supprimer définitivement le service « ${s.name.fr} » ? Les demandes déjà reçues restent lisibles. Pour le masquer seulement, désactivez « Visible sur le site ».`)) return;
                await api(`/api/admin/services/${s.slug}`, "DELETE");
                router.push("/admin/services");
                router.refresh();
              }}
            >
              Supprimer
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={save} disabled={st.busy}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewServiceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const st = useStatus();
  const auto = (v: string) =>
    v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return (
    <form
      className="card flex flex-wrap items-end gap-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const finalSlug = slug || auto(name);
        if (await st.run(() => api("/api/admin/services", "POST", { name, slug: finalSlug }), "Service créé")) router.push(`/admin/services/${finalSlug}`);
      }}
    >
      <div className="min-w-[200px] flex-1">
        <label htmlFor="ns-name" className="field-label">Nouveau service</label>
        <input id="ns-name" className="input" placeholder="Ex. Packaging" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="ns-slug" className="field-label">Identifiant (URL)</label>
        <input id="ns-slug" className="input font-mono text-sm" placeholder={auto(name) || "packaging"} value={slug} onChange={(e) => setSlug(auto(e.target.value))} />
      </div>
      <button type="submit" className="btn-dark" disabled={st.busy || !name.trim()}>Créer</button>
      <StatusLine status={st.status} />
    </form>
  );
}
