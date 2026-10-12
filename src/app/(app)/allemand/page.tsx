"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain, Check, Layers, Plus, RotateCcw, Target, Trash2, TrendingUp } from "lucide-react";
import { Badge, Button, Card, Empty, Field, Loading, Modal, Notice, PageHeader, Progress, Segmented, useUi } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { api, cx, fmtDayNum, refreshAll, relativeDay, useApi } from "@/lib/client";
import { formatDuration, formatTime, today } from "@/lib/dates";
import { GERMAN_OBJECTIVES, GERMAN_TOPICS } from "@/lib/constants";

type Session = { id: string; date: string; startTime: string | null; durationMin: number; topic: string; objective: string; done: boolean; rating: number | null; notes: string | null };
type CardT = { id: string; front: string; back: string; example: string | null; topic: string; ease: number; interval: number; reps: number; lapses: number; dueDate: string };
type ProgressT = {
  weeks: { weekStart: string; minutes: number; sessions: number; reviews: number; success: number | null }[];
  byTopic: { topic: string; label: string; minutes: number }[];
  weeklyGoal: number;
  cardsTotal: number;
  cardsDue: number;
  cardsMastered: number;
  weak: { topics: { topic: string; label: string }[]; hardCards: string[] };
};

export default function AllemandPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Allemand />
    </Suspense>
  );
}

function Allemand() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<"sessions" | "review" | "cards" | "progress">("sessions");
  const [form, setForm] = useState<Partial<Session> | null>(null);
  const sessions = useApi<Session[]>("/api/german/sessions");
  const progress = useApi<ProgressT>("/api/german/progress");

  useEffect(() => {
    if (params.get("new") === "session") {
      setForm({});
      router.replace("/allemand");
    }
  }, [params, router]);

  const t = today();
  const upcoming = (sessions.data ?? []).filter((s) => !s.done && s.date >= t).sort((a, b) => (a.date + (a.startTime ?? "")).localeCompare(b.date + (b.startTime ?? "")));
  const past = (sessions.data ?? []).filter((s) => s.done || s.date < t);
  const pg = progress.data;
  const week = pg?.weeks[pg.weeks.length - 1];

  return (
    <div>
      <PageHeader
        title="Allemand & entretiens"
        subtitle="Niveau B1 → entretiens professionnels. Un peu chaque jour, sans pression."
        actions={
          <Button onClick={() => setForm({})}>
            <Plus className="h-4 w-4" /> Session
          </Button>
        }
      />

      {pg && (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <div className="card p-4">
            <div className="text-xs text-muted">Cette semaine</div>
            <div className="mt-1 font-display text-xl font-semibold text-ink">
              {formatDuration(week?.minutes ?? 0)} <span className="text-xs font-normal text-muted">/ {formatDuration(pg.weeklyGoal)}</span>
            </div>
            <Progress value={pg.weeklyGoal ? ((week?.minutes ?? 0) / pg.weeklyGoal) * 100 : 0} tone="lavender" className="mt-2" />
          </div>
          <div className="card p-4">
            <div className="text-xs text-muted">Cartes à réviser</div>
            <div className="mt-1 font-display text-xl font-semibold text-ink">{pg.cardsDue}</div>
            <Button size="sm" variant="soft" className="mt-2" onClick={() => setTab("review")} disabled={!pg.cardsDue}>
              <Brain className="h-4 w-4" /> Réviser maintenant
            </Button>
          </div>
          <div className="card p-4">
            <div className="text-xs text-muted">Cartes maîtrisées</div>
            <div className="mt-1 font-display text-xl font-semibold text-ink">
              {pg.cardsMastered} <span className="text-xs font-normal text-muted">/ {pg.cardsTotal}</span>
            </div>
            <Progress value={pg.cardsTotal ? (pg.cardsMastered / pg.cardsTotal) * 100 : 0} tone="success" className="mt-2" />
          </div>
        </div>
      )}

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "sessions", label: "Sessions" },
          { value: "review", label: "Révision espacée" },
          { value: "cards", label: "Mes cartes" },
          { value: "progress", label: "Progrès" },
        ]}
      />

      {tab === "sessions" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="À venir" icon={<Target className="h-4 w-4" />}>
            {!sessions.data ? (
              <Loading />
            ) : upcoming.length === 0 ? (
              <Empty title="Aucune session prévue" action={<Button size="sm" onClick={() => setForm({})}>Planifier une session</Button>} />
            ) : (
              <ul className="space-y-2">
                {upcoming.map((s) => (
                  <SessionRow key={s.id} s={s} onEdit={() => setForm(s)} />
                ))}
              </ul>
            )}
          </Card>
          <Card title="Historique" icon={<RotateCcw className="h-4 w-4" />}>
            {past.length === 0 ? (
              <p className="text-sm text-muted">Pas encore de session passée.</p>
            ) : (
              <ul className="space-y-2">
                {past.slice(0, 15).map((s) => (
                  <SessionRow key={s.id} s={s} onEdit={() => setForm(s)} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "review" && <Review onDone={() => progress.mutate()} />}
      {tab === "cards" && <Cards />}
      {tab === "progress" && pg && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Minutes par semaine" icon={<TrendingUp className="h-4 w-4" />}>
            <BarChart
              data={pg.weeks.map((w) => ({ label: fmtDayNum(w.weekStart), value: w.minutes, tooltip: `${formatDuration(w.minutes)} · ${w.sessions} session(s) · ${w.reviews} révision(s)` }))}
              color="rgb(var(--lavender))"
              goal={pg.weeklyGoal}
              format={(v) => `${v} min`}
            />
          </Card>
          <Card title="Sujets travaillés cette semaine" icon={<Layers className="h-4 w-4" />}>
            <ul className="space-y-2">
              {pg.byTopic.map((t) => (
                <li key={t.topic} className="flex items-center gap-3 text-sm">
                  <span className="w-44 shrink-0 truncate text-ink-2">{t.label}</span>
                  <Progress value={Math.min(100, (t.minutes / 60) * 100)} tone="lavender" className="flex-1" />
                  <span className="w-14 text-right text-xs text-muted">{t.minutes ? formatDuration(t.minutes) : "—"}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="À retravailler" icon={<Brain className="h-4 w-4" />} className="lg:col-span-2">
            {pg.weak.topics.length === 0 ? (
              <p className="text-sm text-muted">Rien de particulier pour l&apos;instant : continue comme ça ✨</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {pg.weak.topics.map((t) => (
                    <Button
                      key={t.topic}
                      size="sm"
                      variant="soft"
                      onClick={() => setForm({ topic: t.topic, objective: GERMAN_OBJECTIVES[t.topic]?.[0] ?? "", durationMin: 15 })}
                    >
                      <Plus className="h-3.5 w-3.5" /> {t.label}
                    </Button>
                  ))}
                </div>
                {pg.weak.hardCards.length > 0 && <p className="text-xs text-muted">Cartes difficiles : {pg.weak.hardCards.join(" · ")}</p>}
              </div>
            )}
          </Card>
        </div>
      )}

      {form && <SessionForm initial={form} onClose={() => setForm(null)} />}
    </div>
  );
}

function SessionRow({ s, onEdit }: { s: Session; onEdit: () => void }) {
  const { toast } = useUi();
  const [rateOpen, setRateOpen] = useState(false);
  async function complete(rating?: number) {
    await api(`/api/german/sessions/${s.id}`, { method: "PATCH", body: { done: true, rating } });
    await refreshAll();
    setRateOpen(false);
    toast("Session terminée — Gut gemacht! 🇩🇪");
  }
  return (
    <li className="rounded-xl border border-line/70 p-3">
      <div className="flex items-start gap-3">
        <button
          onClick={() => (s.done ? api(`/api/german/sessions/${s.id}`, { method: "PATCH", body: { done: false } }).then(refreshAll) : setRateOpen(true))}
          className={cx("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", s.done ? "border-success bg-success text-white" : "border-line hover:border-success")}
          aria-label="Terminer"
        >
          {s.done && <Check className="h-3.5 w-3.5" />}
        </button>
        <button onClick={onEdit} className="min-w-0 flex-1 text-left">
          <div className="text-sm font-medium text-ink">{s.objective}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
            <span className="first-letter:uppercase">{relativeDay(s.date, today())}</span>
            {s.startTime && <span>{formatTime(s.startTime)}</span>}
            <span>{s.durationMin} min</span>
            <span className="text-lavender">{GERMAN_TOPICS[s.topic]}</span>
            {s.rating && <span>{"★".repeat(s.rating)}</span>}
          </div>
        </button>
      </div>
      {rateOpen && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/60 p-2 text-xs">
          <span className="text-ink-2">Comment ça s&apos;est passé ?</span>
          {[1, 2, 3, 4, 5].map((r) => (
            <button key={r} onClick={() => complete(r)} className="rounded-lg bg-surface px-2 py-1 hover:bg-lavender-soft">
              {"★".repeat(r)}
            </button>
          ))}
          <button onClick={() => complete()} className="text-muted underline">
            passer
          </button>
        </div>
      )}
    </li>
  );
}

function SessionForm({ initial, onClose }: { initial: Partial<Session>; onClose: () => void }) {
  const { toast, confirm } = useUi();
  const [f, setF] = useState({
    date: initial.date ?? today(),
    startTime: initial.startTime ?? "",
    durationMin: initial.durationMin ?? 30,
    topic: initial.topic ?? "VOCAB",
    objective: initial.objective ?? GERMAN_OBJECTIVES.VOCAB[0],
    notes: initial.notes ?? "",
    autoSlot: !initial.id,
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!f.objective.trim()) return toast("Indique un objectif concret", "danger");
    setSaving(true);
    try {
      const body = { ...f, startTime: f.startTime || null, done: initial.done ?? false, rating: initial.rating ?? null };
      if (initial.id) await api(`/api/german/sessions/${initial.id}`, { method: "PATCH", body });
      else await api("/api/german/sessions", { body });
      await refreshAll();
      toast(initial.id ? "Session modifiée" : "Session planifiée");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? "Session d'allemand" : "Nouvelle session d'allemand"}
      footer={
        <>
          {initial.id && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={async () => {
                if (!(await confirm({ title: "Supprimer cette session ?", danger: true, confirmLabel: "Supprimer" }))) return;
                await api(`/api/german/sessions/${initial.id}`, { method: "DELETE" });
                await refreshAll();
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={save} loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <span className="label">Durée</span>
          <Segmented value={f.durationMin} onChange={(v) => setF({ ...f, durationMin: v })} options={[15, 30, 45, 60].map((d) => ({ value: d, label: `${d} min` }))} />
        </div>
        <Field label="Thème">
          <select className="input" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value, objective: GERMAN_OBJECTIVES[e.target.value]?.[0] ?? f.objective })}>
            {Object.entries(GERMAN_TOPICS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Objectif concret">
          <input className="input" value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {(GERMAN_OBJECTIVES[f.topic] ?? []).map((o) => (
            <button key={o} type="button" onClick={() => setF({ ...f, objective: o })} className="rounded-full bg-lavender-soft px-2.5 py-1 text-xs text-lavender">
              {o}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Heure (facultatif)" hint={!f.startTime && !initial.id ? "Vide : premier créneau libre" : undefined}>
            <input type="time" className="input" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes (mots appris, erreurs…)">
          <textarea className="input min-h-[60px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function Review({ onDone }: { onDone: () => void }) {
  const { data, mutate } = useApi<CardT[]>("/api/german/cards?due=1");
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [count, setCount] = useState(0);
  if (!data) return <Loading />;
  const card = data[idx];
  if (!card)
    return (
      <Card>
        <Empty title={count ? `Bravo, ${count} carte(s) révisée(s) ! 🎉` : "Aucune carte à réviser aujourd'hui"} icon={<Brain className="h-8 w-8" />}>
          La répétition espacée te les reproposera au bon moment.
        </Empty>
      </Card>
    );
  async function grade(g: 0 | 1 | 2 | 3) {
    await api(`/api/german/cards/${card.id}/review`, { body: { grade: g } });
    setFlipped(false);
    setCount((c) => c + 1);
    if (idx + 1 >= data!.length) {
      await mutate();
      setIdx(0);
      onDone();
    } else setIdx(idx + 1);
  }
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-2 flex justify-between text-xs text-muted">
        <span>
          Carte {idx + 1} / {data.length}
        </span>
        <span>{GERMAN_TOPICS[card.topic]}</span>
      </div>
      <button onClick={() => setFlipped(!flipped)} className="card flex min-h-[220px] w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="font-display text-2xl font-semibold text-ink">{card.front}</div>
        {flipped ? (
          <div className="animate-fade-in space-y-2">
            <div className="text-lg text-primary-strong">{card.back}</div>
            {card.example && <div className="text-sm italic text-ink-2">« {card.example} »</div>}
          </div>
        ) : (
          <div className="text-xs text-muted">Touchez pour voir la réponse</div>
        )}
      </button>
      {flipped && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { g: 0 as const, label: "À revoir", cls: "bg-danger-soft text-danger" },
            { g: 1 as const, label: "Difficile", cls: "bg-warning-soft text-warning" },
            { g: 2 as const, label: "Bien", cls: "bg-primary-soft text-primary-strong" },
            { g: 3 as const, label: "Facile", cls: "bg-success-soft text-success" },
          ].map((b) => (
            <button key={b.g} onClick={() => grade(b.g)} className={cx("rounded-xl py-3 text-sm font-medium", b.cls)}>
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Cards() {
  const { toast } = useUi();
  const { data, mutate } = useApi<CardT[]>("/api/german/cards");
  const [f, setF] = useState({ front: "", back: "", example: "", topic: "VOCAB" });
  const [q, setQ] = useState("");
  async function add() {
    if (!f.front.trim() || !f.back.trim()) return toast("Recto et verso requis", "danger");
    try {
      await api("/api/german/cards", { body: f });
      setF({ ...f, front: "", back: "", example: "" });
      mutate();
      toast("Carte ajoutée");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }
  const list = (data ?? []).filter((c) => !q || `${c.front} ${c.back}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card title="Nouvelle carte" className="lg:col-span-1">
        <div className="space-y-3">
          <Field label="Allemand (recto)">
            <input className="input" value={f.front} onChange={(e) => setF({ ...f, front: e.target.value })} placeholder="die Bewerbung" />
          </Field>
          <Field label="Français (verso)">
            <input className="input" value={f.back} onChange={(e) => setF({ ...f, back: e.target.value })} placeholder="la candidature" />
          </Field>
          <Field label="Exemple (facultatif)">
            <input className="input" value={f.example} onChange={(e) => setF({ ...f, example: e.target.value })} />
          </Field>
          <Field label="Thème">
            <select className="input" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>
              {Object.entries(GERMAN_TOPICS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Notice>Astuce : ajoute tes erreurs dans le thème « Révision des erreurs » pour les revoir régulièrement.</Notice>
          <Button className="w-full" onClick={add}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>
      </Card>
      <Card title={`Mes cartes (${data?.length ?? 0})`} className="lg:col-span-2" action={<input className="input h-8 w-40 py-1" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />}>
        {!data ? (
          <Loading />
        ) : list.length === 0 ? (
          <Empty title="Aucune carte" />
        ) : (
          <ul className="divide-y divide-line/60">
            {list.map((c) => (
              <li key={c.id} className="group flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{c.front}</div>
                  <div className="text-xs text-ink-2">{c.back}</div>
                </div>
                <Badge tone={c.interval >= 21 ? "success" : c.lapses >= 2 ? "warning" : "neutral"}>{c.dueDate <= today() ? "à réviser" : `dans ${c.interval} j`}</Badge>
                <button
                  onClick={async () => {
                    await api(`/api/german/cards/${c.id}`, { method: "DELETE" });
                    mutate();
                  }}
                  className="text-muted opacity-0 hover:text-danger group-hover:opacity-100"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
