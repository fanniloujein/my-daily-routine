"use client";

import { useState } from "react";
import { CalendarPlus, Clapperboard, Heart, Leaf, Plus, Popcorn, Star, Trash2, Tv } from "lucide-react";
import { Badge, Button, Card, Empty, Field, Loading, Modal, PageHeader, Segmented, useUi } from "@/components/ui";
import { WhatNow } from "@/components/WhatNow";
import { ApiError, api, cx, fmtDayNum, refreshAll, useApi } from "@/lib/client";
import { formatDuration, formatTime, today } from "@/lib/dates";
import { MEDIA_STATUS_LABELS } from "@/lib/constants";

type Media = { id: string; title: string; type: "MOVIE" | "SERIES"; genre: string | null; durationMin: number; status: "TO_WATCH" | "WATCHING" | "DONE"; liked: boolean; rating: number | null; notes: string | null };
type Idea = { id: string; title: string; durationMin: number; minEnergy: number; kind: string };

const KIND: Record<string, string> = { RELAX: "Détente", MOVE: "Bouger", CREATIVE: "Créatif", SOCIAL: "Social", READ: "Lecture" };

export default function LoisirsPage() {
  const media = useApi<Media[]>("/api/media");
  const ideas = useApi<Idea[]>("/api/leisure");
  const { toast } = useUi();
  const [filter, setFilter] = useState<"TO_WATCH" | "WATCHING" | "DONE" | "LIKED">("TO_WATCH");
  const [form, setForm] = useState<Partial<Media> | null>(null);
  const [planFor, setPlanFor] = useState<Media | null>(null);
  const [idea, setIdea] = useState({ title: "", durationMin: 30, kind: "RELAX", minEnergy: 1 });

  const list = (media.data ?? []).filter((m) => (filter === "LIKED" ? m.liked : m.status === filter));

  async function patch(m: Media, body: Partial<Media>) {
    await api(`/api/media/${m.id}`, { method: "PATCH", body });
    media.mutate();
  }

  return (
    <div>
      <PageHeader
        title="Films, séries & loisirs"
        subtitle="Profiter de son temps libre, sans culpabiliser."
        actions={
          <Button onClick={() => setForm({})}>
            <Plus className="h-4 w-4" /> Film ou série
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "TO_WATCH", label: "À voir" },
              { value: "WATCHING", label: "En cours" },
              { value: "DONE", label: "Terminés" },
              { value: "LIKED", label: "Coups de cœur" },
            ]}
          />
          {!media.data ? (
            <Loading />
          ) : list.length === 0 ? (
            <Empty icon={<Clapperboard className="h-8 w-8" />} title="Rien dans cette liste" action={<Button size="sm" onClick={() => setForm({})}>Ajouter</Button>} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((m) => (
                <div key={m.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lavender-soft text-lavender">{m.type === "MOVIE" ? <Popcorn className="h-5 w-5" /> : <Tv className="h-5 w-5" />}</span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => setForm(m)}>
                      <div className="font-medium text-ink">{m.title}</div>
                      <div className="text-xs text-muted">
                        {m.type === "MOVIE" ? "Film" : "Série"}
                        {m.genre ? ` · ${m.genre}` : ""} · {m.type === "SERIES" ? `${m.durationMin} min/épisode` : formatDuration(m.durationMin)}
                      </div>
                      {m.rating && <div className="text-xs text-warning">{"★".repeat(m.rating)}</div>}
                    </button>
                    <button onClick={() => patch(m, { liked: !m.liked })} className={cx("rounded-lg p-1", m.liked ? "text-danger" : "text-muted")} aria-label="J'aime">
                      <Heart className={cx("h-4 w-4", m.liked && "fill-current")} />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select value={m.status} onChange={(e) => patch(m, { status: e.target.value as Media["status"] })} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs" aria-label="Statut">
                      {Object.entries(MEDIA_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    {m.status !== "DONE" && (
                      <Button size="sm" variant="soft" onClick={() => setPlanFor(m)}>
                        <CalendarPlus className="h-3.5 w-3.5" /> {m.type === "MOVIE" ? "Soirée cinéma" : "Planifier"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Envie de souffler ?" icon={<Leaf className="h-4 w-4" />}>
            <p className="mb-3 text-sm text-ink-2">Des idées adaptées à ton temps libre et à ton énergie du moment.</p>
            <WhatNow />
          </Card>
          <Card title="Mes activités relaxantes" icon={<Star className="h-4 w-4" />}>
            {!ideas.data ? (
              <Loading />
            ) : (
              <ul className="mb-3 space-y-1.5">
                {ideas.data.length === 0 && <li className="text-sm text-muted">Ajoute tes propres idées de détente.</li>}
                {ideas.data.map((i) => (
                  <li key={i.id} className="group flex items-center gap-2 text-sm">
                    <span className="flex-1 text-ink">{i.title}</span>
                    <Badge>{KIND[i.kind]}</Badge>
                    <span className="text-xs text-muted">{i.durationMin} min</span>
                    <button
                      onClick={async () => {
                        await api(`/api/leisure/${i.id}`, { method: "DELETE" });
                        ideas.mutate();
                      }}
                      className="text-muted opacity-0 hover:text-danger group-hover:opacity-100"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="space-y-2 rounded-xl bg-surface-2/60 p-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!idea.title.trim()) return;
                await api("/api/leisure", { body: idea });
                setIdea({ ...idea, title: "" });
                ideas.mutate();
                toast("Idée ajoutée");
              }}
            >
              <input className="input h-9" placeholder="Ex. Faire un puzzle" value={idea.title} onChange={(e) => setIdea({ ...idea, title: e.target.value })} />
              <div className="flex gap-2">
                <select className="input h-9 py-1" value={idea.kind} onChange={(e) => setIdea({ ...idea, kind: e.target.value })}>
                  {Object.entries(KIND).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input type="number" className="input h-9 w-20 py-1" min={5} step={5} value={idea.durationMin} onChange={(e) => setIdea({ ...idea, durationMin: Number(e.target.value) || 30 })} aria-label="Durée" />
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
      {form && <MediaForm initial={form} onClose={() => setForm(null)} onSaved={() => media.mutate()} />}
      {planFor && <PlanNight m={planFor} onClose={() => setPlanFor(null)} />}
    </div>
  );
}

function MediaForm({ initial, onClose, onSaved }: { initial: Partial<Media>; onClose: () => void; onSaved: () => void }) {
  const { toast, confirm } = useUi();
  const [f, setF] = useState({
    title: initial.title ?? "",
    type: initial.type ?? "MOVIE",
    genre: initial.genre ?? "",
    durationMin: initial.durationMin ?? 110,
    status: initial.status ?? "TO_WATCH",
    liked: initial.liked ?? false,
    rating: initial.rating ?? null,
    notes: initial.notes ?? "",
  });
  async function save() {
    if (!f.title.trim()) return toast("Titre requis", "danger");
    try {
      if (initial.id) await api(`/api/media/${initial.id}`, { method: "PATCH", body: f });
      else await api("/api/media", { body: f });
      onSaved();
      toast("Enregistré");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? "Modifier" : "Ajouter un film ou une série"}
      footer={
        <>
          {initial.id && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={async () => {
                if (!(await confirm({ title: "Retirer de la liste ?", danger: true, confirmLabel: "Retirer" }))) return;
                await api(`/api/media/${initial.id}`, { method: "DELETE" });
                onSaved();
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Segmented value={f.type} onChange={(v) => setF({ ...f, type: v, durationMin: v === "SERIES" ? 45 : 110 })} options={[{ value: "MOVIE", label: "Film" }, { value: "SERIES", label: "Série" }]} />
        <Field label="Titre">
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Genre">
            <input className="input" value={f.genre} onChange={(e) => setF({ ...f, genre: e.target.value })} />
          </Field>
          <Field label={f.type === "SERIES" ? "Durée d'un épisode (min)" : "Durée (min)"}>
            <input type="number" min={1} className="input" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) || 30 })} />
          </Field>
        </div>
        <div>
          <span className="label">Note</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((r) => (
              <button key={r} type="button" onClick={() => setF({ ...f, rating: f.rating === r ? null : r })} className={cx("text-xl", (f.rating ?? 0) >= r ? "text-warning" : "text-line")} aria-label={`${r} étoile(s)`}>
                ★
              </button>
            ))}
          </div>
        </div>
        <Field label="Notes">
          <textarea className="input min-h-[50px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function PlanNight({ m, onClose }: { m: Media; onClose: () => void }) {
  const { toast } = useUi();
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("20:30");
  const [conflict, setConflict] = useState<string | null>(null);
  async function plan(allowConflict = false) {
    try {
      await api(`/api/media/${m.id}/plan`, { body: { date, startTime: time, allowConflict } });
      await refreshAll();
      toast(`C'est prévu : ${fmtDayNum(date)} à ${formatTime(time)} 🍿`);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const c = e.data as { conflicts: { title: string }[] };
        setConflict(`Chevauche : ${c.conflicts.map((x) => x.title).join(", ")}`);
      } else toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={m.type === "MOVIE" ? "Planifier une soirée cinéma" : "Planifier un épisode"}
      size="sm"
      footer={
        <>
          {conflict && (
            <Button variant="secondary" onClick={() => plan(true)}>
              Garder quand même
            </Button>
          )}
          <Button onClick={() => plan(false)}>Planifier</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-2">
          « {m.title} » · {formatDuration(m.durationMin)}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Heure">
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        {conflict && <p className="rounded-xl bg-warning-soft p-2 text-xs text-warning">{conflict}</p>}
      </div>
    </Modal>
  );
}
