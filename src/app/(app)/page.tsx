"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlarmClock, ArrowRight, CalendarClock, Check, Clock, Code, Dumbbell, Eye, EyeOff, Feather, GraduationCap, Languages, ListChecks, NotebookPen, Pill, Sparkles, Star, Sun, Wand2,
} from "lucide-react";
import { Badge, Button, Card, Empty, ErrorBox, Loading, Notice, Progress, Ring, useUi } from "@/components/ui";
import { ActivityItem } from "@/components/activity/ActivityItem";
import { PlanDialog } from "@/components/PlanDialog";
import { WhatNow } from "@/components/WhatNow";
import { api, cx, fmtDateLong, fmtDayNum, refreshAll, relativeDay, useApi } from "@/lib/client";
import { formatDuration, formatTime } from "@/lib/dates";
import { ENERGY_EMOJI, ENERGY_LABELS, MOOD_LABELS, STRESS_LABELS } from "@/lib/constants";
import type { Occurrence } from "@/lib/hooks";
import type { Readiness } from "@/server/lessons";
import type { Dose } from "@/server/meds";

type Dashboard = {
  date: string;
  now: string;
  name: string;
  settings: { privacyMode: boolean; dayEnd: string };
  energy: { energy: number; mood: number | null; stress: number | null } | null;
  schedule: Occurrence[];
  priorities: Occurrence[];
  next: Occurrence[];
  doses: Dose[];
  lessons: { id: string; date: string; startTime: string; endTime: string; subject: string; chapter: string | null; student: { id: string; name: string; color: string }; readiness: Readiness }[];
  prepTasks: Occurrence[];
  urgentTasks: { id: string; title: string; project: string; projectId: string; client: string; dueDate: string | null; priority: number; status: string }[];
  german: { todayMinutes: number; weekMinutes: number; weekGoal: number; dueCards: number };
  nextSport: Occurrence | null;
  freeTime: { minutes: number; slots: { start: string; end: string }[]; untimedMinutes: number };
  progress: { done: number; total: number; percent: number };
  hasDemo: boolean;
};

function greeting(now: string) {
  const h = Number(now.slice(0, 2));
  if (h < 5 || h >= 18) return "Bonsoir";
  if (h < 12) return "Bonjour";
  return "Bon après-midi";
}

function encouragement(p: number, energy?: number) {
  if (energy && energy <= 2) return "Aujourd'hui, on y va doucement. L'essentiel suffit.";
  if (p >= 100) return "Tout est fait. Profite de ton temps libre ✨";
  if (p >= 60) return "Belle avancée ! Pense à faire une pause.";
  if (p > 0) return "Une chose après l'autre, tu avances bien.";
  return "Voici ta journée. Commence par ce qui compte le plus.";
}

export default function DashboardPage() {
  const { data, error, isLoading, mutate } = useApi<Dashboard>("/api/dashboard");
  const [plan, setPlan] = useState<{ light: boolean } | null>(null);
  const [reveal, setReveal] = useState(false);

  if (error) return <ErrorBox error={error} onRetry={() => mutate()} />;
  if (isLoading || !data) return <Loading />;

  const d = data;
  const energy = d.energy?.energy;
  const timed = d.schedule.filter((o) => o.startTime);
  const untimed = d.schedule.filter((o) => !o.startTime);
  const hideMeds = d.settings.privacyMode && !reveal;

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-[#2c4583] to-[#6f6fd8] p-5 text-white shadow-card sm:p-7 dark:from-[#1a2546] dark:via-[#25356a] dark:to-[#4a4596]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-sm first-letter:uppercase text-white/75">{fmtDateLong(d.date)}</p>
            <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
              {greeting(d.now)} {d.name} {energy ? ENERGY_EMOJI[energy] : "👋"}
            </h1>
            <p className="mt-1 text-sm text-white/80">{encouragement(d.progress.percent, energy)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="white" onClick={() => setPlan({ light: false })}>
                <Wand2 className="h-4 w-4" /> Organiser ma journée
              </Button>
              <Button variant="glass" onClick={() => setPlan({ light: true })}>
                <Feather className="h-4 w-4" /> Mode journée légère
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-3 backdrop-blur">
            <div className="rounded-full bg-white p-1 dark:bg-surface">
              <Ring value={d.progress.percent} size={76} />
            </div>
            <div className="text-sm">
              <div className="font-semibold">Progression du jour</div>
              <div className="text-white/75">
                {d.progress.done} / {d.progress.total} éléments
              </div>
            </div>
          </div>
        </div>
      </section>

      {d.hasDemo && (
        <Notice>
          Des données de démonstration sont affichées. Tu peux les supprimer à tout moment dans <Link className="font-medium underline" href="/parametres">Paramètres</Link>.
        </Notice>
      )}

      {!d.energy && <EnergyCheckin date={d.date} onDone={() => mutate()} />}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-5 lg:col-span-2">
          <Card title="Mes 3 priorités" icon={<Star className="h-4 w-4" />}>
            {d.priorities.length === 0 ? (
              <Empty title="Aucune priorité pour aujourd'hui">Ajoute une tâche avec le bouton + ou demande à l&apos;assistant.</Empty>
            ) : (
              <ol className="space-y-1">
                {d.priorities.map((o, i) => (
                  <li key={o.key} className="flex items-center gap-2">
                    <span className="w-5 text-center font-display text-sm font-semibold text-lavender">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <ActivityItem o={o} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card
            title="Planning de la journée"
            icon={<CalendarClock className="h-4 w-4" />}
            action={
              <Link href="/planning" className="flex items-center gap-1 text-xs font-medium text-primary-strong">
                Calendrier <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {d.schedule.length === 0 ? (
              <Empty title="Journée libre pour l'instant" icon={<Sun className="h-6 w-6" />}>
                Profite, ou ajoute une activité avec le bouton +.
              </Empty>
            ) : (
              <div className="space-y-4">
                {timed.length > 0 && (
                  <div className="relative space-y-0.5">
                    {timed.map((o) => {
                      const nowLine = o.startTime! <= d.now && o.endTime! > d.now;
                      return (
                        <div key={o.key} className={cx("rounded-xl", nowLine && "ring-2 ring-primary/40")}>
                          <ActivityItem o={o} />
                        </div>
                      );
                    })}
                  </div>
                )}
                {untimed.length > 0 && (
                  <div>
                    <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">Sans horaire fixe</h3>
                    {untimed.map((o) => (
                      <ActivityItem key={o.key} o={o} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <div className="grid gap-5 sm:grid-cols-2">
            <Card title="Prochaines séances de cours" icon={<GraduationCap className="h-4 w-4" />} action={<Link href="/cours" className="text-xs font-medium text-primary-strong">Voir</Link>}>
              {d.lessons.length === 0 ? (
                <Empty title="Aucune séance prévue" />
              ) : (
                <ul className="space-y-2">
                  {d.lessons.map((l) => (
                    <li key={l.id}>
                      <Link href={`/cours?lesson=${l.id}`} className="block rounded-xl border border-line/70 p-3 transition hover:bg-surface-2/60">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-sm font-medium text-ink">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.student.color }} />
                            {l.student.name}
                          </span>
                          <span className="text-xs text-muted">
                            {relativeDay(l.date, d.date)} · {formatTime(l.startTime)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-ink-2">
                          {l.subject}
                          {l.chapter ? ` — ${l.chapter}` : ""}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={l.readiness.progress} tone={l.readiness.state === "at_risk" ? "warning" : "success"} className="flex-1" />
                          <span className="text-[11px] text-muted">{l.readiness.progress} %</span>
                        </div>
                        {l.readiness.state === "at_risk" && <p className="mt-1 text-[11px] font-medium text-warning">⚠ {l.readiness.message}</p>}
                        {l.readiness.state === "ready" && <p className="mt-1 text-[11px] text-success">✓ Prête !</p>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Préparation des cours" icon={<NotebookPen className="h-4 w-4" />}>
              {d.prepTasks.length === 0 ? (
                <Empty title="Aucune préparation en attente" />
              ) : (
                d.prepTasks.map((o) => <ActivityItem key={o.key} o={o} compact showDate />)
              )}
            </Card>
          </div>

          <Card title="Urgent — projets freelance" icon={<Code className="h-4 w-4" />} action={<Link href="/projets" className="text-xs font-medium text-primary-strong">Projets</Link>}>
            {d.urgentTasks.length === 0 ? (
              <Empty title="Rien d'urgent côté projets 🎉" />
            ) : (
              <ul className="divide-y divide-line/60">
                {d.urgentTasks.map((t) => (
                  <li key={t.id}>
                    <Link href={`/projets/${t.projectId}`} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">{t.title}</div>
                        <div className="text-xs text-muted">
                          {t.project} · {t.client}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {t.priority >= 4 && <Badge tone="danger">Urgent</Badge>}
                        {t.dueDate && <Badge tone="warning">{fmtDayNum(t.dueDate)}</Badge>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          <Card
            title="Médicaments"
            icon={<Pill className="h-4 w-4" />}
            action={
              d.doses.length > 0 && d.settings.privacyMode ? (
                <button onClick={() => setReveal(!reveal)} className="flex items-center gap-1 text-xs text-muted" aria-label={reveal ? "Masquer les noms" : "Afficher les noms"}>
                  {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {reveal ? "Masquer" : "Afficher"}
                </button>
              ) : undefined
            }
          >
            {d.doses.length === 0 ? (
              <p className="text-sm text-muted">Aucune prise prévue aujourd&apos;hui.</p>
            ) : (
              <ul className="space-y-1.5">
                {d.doses.map((dose) => (
                  <DoseRow key={dose.medicationId + dose.time} dose={dose} hidden={hideMeds} />
                ))}
              </ul>
            )}
            <Link href="/sante" className="mt-3 block text-xs font-medium text-primary-strong">
              Gérer mes rappels santé →
            </Link>
          </Card>

          <Card title="Prochaines activités" icon={<AlarmClock className="h-4 w-4" />}>
            {d.next.length === 0 ? (
              <p className="text-sm text-muted">Rien de prévu avec un horaire.</p>
            ) : (
              <ul className="space-y-2">
                {d.next.map((o) => (
                  <li key={o.key} className="flex items-center gap-3">
                    <span className="h-8 w-1 rounded-full" style={{ background: o.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-ink">{o.title}</div>
                      <div className="text-xs text-muted">
                        {relativeDay(o.date, d.date)} · {formatTime(o.startTime)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Allemand" icon={<Languages className="h-4 w-4" />} action={<Link href="/allemand" className="text-xs font-medium text-primary-strong">Réviser</Link>}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-2">Prévu aujourd&apos;hui</span>
                <strong className="text-ink">{d.german.todayMinutes ? formatDuration(d.german.todayMinutes) : "—"}</strong>
              </div>
              <div className="flex justify-between text-xs text-muted">
                <span>Cette semaine</span>
                <span>
                  {formatDuration(d.german.weekMinutes)} / {formatDuration(d.german.weekGoal)}
                </span>
              </div>
              <Progress value={d.german.weekGoal ? (d.german.weekMinutes / d.german.weekGoal) * 100 : 0} tone="lavender" />
              {d.german.dueCards > 0 && <p className="text-xs text-lavender">{d.german.dueCards} carte(s) à réviser aujourd&apos;hui</p>}
            </div>
          </Card>

          <Card title="Prochain entraînement" icon={<Dumbbell className="h-4 w-4" />} action={<Link href="/sport" className="text-xs font-medium text-primary-strong">Sport</Link>}>
            {d.nextSport ? (
              <div className="text-sm">
                <div className="font-medium text-ink">{d.nextSport.title}</div>
                <div className="text-xs text-muted">
                  {relativeDay(d.nextSport.date, d.date)}
                  {d.nextSport.startTime ? ` · ${formatTime(d.nextSport.startTime)}` : ""} · {formatDuration(d.nextSport.durationMin)}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Aucune séance planifiée. Une marche compte aussi !</p>
            )}
          </Card>

          <Card title="Temps libre" icon={<Clock className="h-4 w-4" />}>
            <p className="text-sm text-ink-2">
              Environ <strong className="text-ink">{formatDuration(d.freeTime.minutes)}</strong> de libre d&apos;ici {formatTime(d.settings.dayEnd)}
              {d.freeTime.untimedMinutes > 0 && <span className="text-muted"> (après les tâches sans horaire)</span>}.
            </p>
            {d.freeTime.slots.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.freeTime.slots.map((s) => (
                  <Badge key={s.start} tone="success">
                    {formatTime(s.start)}–{formatTime(s.end)}
                  </Badge>
                ))}
              </div>
            )}
            <WhatNow className="mt-3" />
          </Card>

          <Card title="Énergie du jour" icon={<Sparkles className="h-4 w-4" />}>
            {d.energy ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-2xl">{ENERGY_EMOJI[d.energy.energy]}</div>
                  <div className="text-sm font-medium text-ink">{ENERGY_LABELS[d.energy.energy]}</div>
                  <div className="text-xs text-muted">
                    {d.energy.mood ? `Humeur : ${MOOD_LABELS[d.energy.mood]}` : ""}
                    {d.energy.stress ? ` · Stress : ${STRESS_LABELS[d.energy.stress].toLowerCase()}` : ""}
                  </div>
                </div>
                <EnergyEdit date={d.date} current={d.energy.energy} onDone={() => mutate()} />
              </div>
            ) : (
              <p className="text-sm text-muted">Pas encore renseignée.</p>
            )}
          </Card>
        </div>
      </div>

      {plan && <PlanDialog open onClose={() => setPlan(null)} date={d.date} defaultEnergy={energy ?? 3} light={plan.light} />}
    </div>
  );
}

function DoseRow({ dose, hidden }: { dose: Dose; hidden: boolean }) {
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  async function log(status: "TAKEN" | "MISSED" | "PENDING") {
    setBusy(true);
    try {
      await api("/api/medications/log", { body: { medicationId: dose.medicationId, date: dose.date, time: dose.time, status } });
      await refreshAll();
      if (status === "TAKEN") toast("Prise confirmée ✓");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    } finally {
      setBusy(false);
    }
  }
  const taken = dose.status === "TAKEN";
  return (
    <li className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2">
      <span className={cx("w-12 text-sm font-semibold tabular-nums", dose.status === "LATE" ? "text-warning" : "text-ink")}>{formatTime(dose.time)}</span>
      <span className={cx("min-w-0 flex-1 truncate text-sm", hidden && "select-none blur-[5px]")} aria-hidden={hidden}>
        {hidden ? "Médicament masqué" : dose.name}
      </span>
      {taken ? (
        <button onClick={() => log("PENDING")} disabled={busy} className="chip bg-success-soft text-success" title="Annuler la confirmation">
          <Check className="h-3 w-3" /> Pris
        </button>
      ) : dose.status === "MISSED" ? (
        <button onClick={() => log("PENDING")} disabled={busy} className="chip bg-surface text-muted">
          Manqué
        </button>
      ) : (
        <button onClick={() => log("TAKEN")} disabled={busy} className={cx("chip", dose.status === "LATE" ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary-strong")}>
          {dose.status === "LATE" ? "À confirmer" : "Je l'ai pris"}
        </button>
      )}
    </li>
  );
}

function EnergyCheckin({ date, onDone }: { date: string; onDone: () => void }) {
  const { toast } = useUi();
  const [energy, setEnergy] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!energy) return;
    setSaving(true);
    try {
      await api("/api/energy", { body: { date, energy, mood, stress } });
      toast(energy <= 2 ? "Merci. On allège la journée, tu as le droit 💙" : "C'est noté, belle journée !");
      await refreshAll();
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card title="Comment te sens-tu ce matin ?" icon={<Sun className="h-4 w-4" />} className="border-lavender/40 bg-lavender-soft/30">
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setEnergy(n)}
            className={cx(
              "flex min-w-0 flex-col items-center gap-1 rounded-2xl border p-1.5 text-[10px] transition sm:p-3 sm:text-xs",
              energy === n ? "border-primary bg-primary-soft text-primary-strong" : "border-line bg-surface text-ink-2 hover:border-primary/50",
            )}
          >
            <span className="text-xl sm:text-2xl">{ENERGY_EMOJI[n]}</span>
            <span className="break-words text-center leading-tight [hyphens:auto]">{ENERGY_LABELS[n].replace("Énergie ", "").replace(" énergie", "")}</span>
          </button>
        ))}
      </div>
      {energy && (
        <div className="mt-4 space-y-3 animate-fade-in">
          <ScaleRow label="Humeur (facultatif)" labels={MOOD_LABELS} value={mood} onChange={setMood} />
          <ScaleRow label="Stress (facultatif)" labels={STRESS_LABELS} value={stress} onChange={setStress} />
          <div className="flex justify-end">
            <Button onClick={save} loading={saving}>
              <ListChecks className="h-4 w-4" /> Enregistrer
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function ScaleRow({ label, labels, value, onChange }: { label: string; labels: Record<number, string>; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onChange(value === n ? null : n)} className={cx("rounded-full px-3 py-1 text-xs", value === n ? "bg-lavender text-white" : "bg-surface text-ink-2")}>
            {labels[n]}
          </button>
        ))}
      </div>
    </div>
  );
}

function EnergyEdit({ date, current, onDone }: { date: string; current: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Modifier
      </Button>
    );
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className={cx("rounded-lg p-1 text-lg", n === current && "bg-primary-soft")}
          title={ENERGY_LABELS[n]}
          onClick={async () => {
            await api("/api/energy", { body: { date, energy: n } });
            setOpen(false);
            await refreshAll();
            onDone();
          }}
        >
          {ENERGY_EMOJI[n]}
        </button>
      ))}
    </div>
  );
}
