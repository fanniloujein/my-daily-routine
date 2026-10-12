"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Scale } from "lucide-react";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Progress, Segmented } from "@/components/ui";
import { BarChart, HBars } from "@/components/charts";
import { fmtDayNum, useApi } from "@/lib/client";
import { addDays, addMonths, endOfMonth, formatDuration, startOfMonth, startOfWeek, today } from "@/lib/dates";
import { ENERGY_EMOJI } from "@/lib/constants";
import type { Stats } from "@/server/stats";

export default function StatsPage() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(today());
  const from = period === "week" ? startOfWeek(anchor) : startOfMonth(anchor);
  const to = period === "week" ? addDays(from, 6) : endOfMonth(anchor);
  const { data: s, error } = useApi<Stats>(`/api/stats?from=${from}&to=${to}`);

  const step = (n: number) => setAnchor(period === "week" ? addDays(anchor, 7 * n) : addMonths(anchor, n));
  const totalBalance = s ? Object.values(s.balance).reduce((a, b) => a + b, 0) : 0;

  return (
    <div>
      <PageHeader title="Statistiques" subtitle="Comprendre où passe ton temps — pour t'aider, jamais pour te juger." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented value={period} onChange={setPeriod} options={[{ value: "week", label: "Semaine" }, { value: "month", label: "Mois" }]} />
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => step(-1)} aria-label="Période précédente">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-medium text-ink">
            {fmtDayNum(from)} → {fmtDayNum(to)}
          </span>
          <Button size="icon" variant="ghost" onClick={() => step(1)} aria-label="Période suivante">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
      {error ? (
        <ErrorBox error={error} />
      ) : !s ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile label="Activités terminées" value={String(s.tasksDone)} sub={`sur ${s.tasksPlanned} prévues`} />
            <Tile label="Séances de cours" value={String(s.lessonsDone)} sub={`préparation ${formatDuration(s.prepMinutes)}`} />
            <Tile label="Allemand" value={formatDuration(s.germanMinutes)} sub={`${s.germanSessions} session(s) · ${s.flashcardsReviewed} carte(s)`} />
            <Tile label="Sport" value={`${s.sportDone} séance(s)`} sub={formatDuration(s.sportMinutes)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Activités terminées par jour">
              <BarChart data={s.daily.map((d) => ({ label: period === "week" ? new Date(d.date + "T12:00").toLocaleDateString("fr-FR", { weekday: "short" }) : d.date.slice(8), value: d.done, tooltip: `${d.done} terminée(s) / ${d.planned} prévue(s)` }))} color="rgb(var(--success))" />
            </Card>
            <Card title="Temps par catégorie (activités terminées)">
              {s.byCategory.length === 0 ? <Empty title="Pas encore de données" /> : <HBars data={s.byCategory.map((c) => ({ label: c.name, value: c.minutes, color: c.color }))} format={formatDuration} />}
            </Card>
            <Card title="Équilibre travail / repos" icon={<Scale className="h-4 w-4" />}>
              {totalBalance === 0 ? (
                <Empty title="Pas encore de données" />
              ) : (
                <div className="space-y-3">
                  <div className="flex h-4 overflow-hidden rounded-full" role="img" aria-label="Répartition travail, repos, santé, personnel">
                    {[
                      ["work", "rgb(var(--primary))"],
                      ["rest", "rgb(var(--lavender))"],
                      ["health", "rgb(var(--success))"],
                      ["personal", "rgb(var(--warning))"],
                    ].map(([k, c]) =>
                      s.balance[k] ? <div key={k} style={{ width: `${(s.balance[k] / totalBalance) * 100}%`, background: c }} className="border-r-2 border-surface last:border-0" /> : null,
                    )}
                  </div>
                  <ul className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      ["work", "Travail", "rgb(var(--primary))"],
                      ["rest", "Repos & loisirs", "rgb(var(--lavender))"],
                      ["health", "Santé & sport", "rgb(var(--success))"],
                      ["personal", "Personnel", "rgb(var(--warning))"],
                    ].map(([k, l, c]) => (
                      <li key={k} className="flex items-center gap-2 text-ink-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} /> {l} <span className="ml-auto font-medium text-ink">{formatDuration(s.balance[k] ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted">
                    {(s.balance.rest ?? 0) < (s.balance.work ?? 0) * 0.2
                      ? "Le repos est un peu discret cette période : pense à te réserver du temps rien que pour toi."
                      : "Bel équilibre entre travail et temps pour toi 🌿"}
                  </p>
                </div>
              )}
            </Card>
            <Card title="Projets freelance">
              {s.projects.length === 0 ? (
                <Empty title="Aucun projet actif" />
              ) : (
                <ul className="space-y-3">
                  {s.projects.map((p) => (
                    <li key={p.id} className="text-sm">
                      <div className="mb-1 flex justify-between gap-2">
                        <span className="truncate text-ink">
                          {p.name} <span className="text-xs text-muted">· {p.client}</span>
                        </span>
                        <span className="text-xs text-muted">
                          {p.tasksDone}/{p.tasksTotal} · {formatDuration(p.spentMin)}
                        </span>
                      </div>
                      <Progress value={p.progress} tone={p.progress === 100 ? "success" : "primary"} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Allemand par thème">
              {s.germanByTopic.length === 0 ? (
                <Empty title="Aucune session terminée sur la période" />
              ) : (
                <HBars data={s.germanByTopic.map((g) => ({ label: `${g.label}${g.avgRating ? ` (${g.avgRating}★)` : ""}`, value: g.minutes, color: "rgb(var(--lavender))" }))} format={formatDuration} />
              )}
              {s.flashcardSuccess !== null && <p className="mt-3 text-xs text-muted">Réussite aux cartes : {s.flashcardSuccess} %</p>}
            </Card>
            <Card title="Énergie et reports">
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  {s.energy.length === 0 ? (
                    <span className="text-muted">Aucun ressenti enregistré.</span>
                  ) : (
                    s.energy.map((e) => (
                      <span key={e.date} className="flex flex-col items-center rounded-xl bg-surface-2/70 px-2 py-1 text-xs" title={`${fmtDayNum(e.date)} : ${e.energy}/5`}>
                        <span className="text-lg">{ENERGY_EMOJI[e.energy]}</span>
                        <span className="text-muted">{fmtDayNum(e.date)}</span>
                      </span>
                    ))
                  )}
                </div>
                <p className="text-ink-2">
                  <strong className="text-ink">{s.postponed}</strong> occurrence(s) reportée(s) sur la période. Reporter, c&apos;est s&apos;adapter — pas échouer.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-ink">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
