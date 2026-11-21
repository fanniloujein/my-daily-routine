"use client";
import { useState } from "react";
import { Clock, Coffee, Gauge, Plus, Timer, Trash2 } from "lucide-react";
import { api, cn, qsOf, useApi } from "@/lib/client";
import { TIME_CATEGORIES } from "@/lib/constants";
import { addDays, dayName, formatMinutes, shortDate, startOfMonth, startOfWeek, today } from "@/lib/dates";
import { LOAD_LABELS } from "@/lib/schedule";
import { Badge, Button, Card, Empty, Field, Input, Loading, PageHeader, Segmented, Select } from "@/components/ui";
import { Bars } from "@/components/charts";
import { PersonalEventDialog } from "@/components/PersonalEventDialog";

type P = {
  days: ({ date: string } & Record<string, number>)[];
  totals: Record<string, number>;
  entries: { id: string; date: string; category: string; minutes: number; note: string | null }[];
  forecast: { date: string; sessions: number; teachingMinutes: number; restMinutes: number; load: keyof typeof LOAD_LABELS; free: { startTime: string; endTime: string; minutes: number }[]; breaks: { after: string; gap: number }[] }[];
  settings: { maxDailyHours: number; breakMinutes: number };
};
const LOAD_TONE = { LIGHT: "success", NORMAL: "info", BUSY: "warning", OVERLOADED: "danger" } as const;
const MANUAL = Object.fromEntries(Object.entries(TIME_CATEGORIES).filter(([k]) => k !== "TEACHING").map(([k, v]) => [k, v.label]));

export default function TimePage() {
  const t = today();
  const [period, setPeriod] = useState<"week" | "month" | "30">("week");
  const from = period === "week" ? startOfWeek(t) : period === "month" ? startOfMonth(t) : addDays(t, -29);
  const to = period === "week" ? addDays(startOfWeek(t), 6) : t;
  const { data, mutate } = useApi<P>(`/api/productivity${qsOf({ from, to })}`);
  const [v, setV] = useState({ date: t, category: "PREP", minutes: "30", note: "" });
  const [rest, setRest] = useState<{ date: string; startTime: string; endTime: string } | null>(null);
  const add = async () => { await api("/api/time-entries", { body: { ...v, minutes: Number(v.minutes) } }); setV({ ...v, note: "" }); mutate(); };
  const del = async (id: string) => { await api(`/api/time-entries/${id}`, { method: "DELETE" }); mutate(); };
  const cats = Object.entries(TIME_CATEGORIES).filter(([k]) => k !== "OTHER" || data?.totals.OTHER);
  const work = (data?.totals.TEACHING ?? 0) + (data?.totals.PREP ?? 0) + (data?.totals.CORRECTION ?? 0) + (data?.totals.ADMIN ?? 0);
  const restMin = (data?.totals.REST ?? 0) + (data?.totals.FREE ?? 0);
  const nDays = data ? Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 864e5) + 1) : 7;
  const chartDays = data ? Array.from({ length: nDays }, (_, i) => addDays(from, i)).map((d) => ({ date: d, ...Object.fromEntries(Object.keys(TIME_CATEGORIES).map((k) => [k, Math.round(((data.days.find((x) => x.date === d)?.[k] as number) ?? 0) / 6) / 10])) })) : [];

  return (
    <div className="space-y-5">
      <PageHeader title="Temps & productivité" icon={<Clock className="h-5 w-5" />} subtitle="Heures de cours (automatiques), de préparation, de correction, d'administration, de repos…" actions={<Segmented value={period} onChange={setPeriod} options={[{ value: "week", label: "Cette semaine" }, { value: "month", label: "Ce mois" }, { value: "30", label: "30 jours" }]} />} />
      {!data ? <Loading rows={6} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="card p-4"><div className="text-xs text-muted">Temps de travail</div><div className="font-display text-xl font-semibold">{formatMinutes(work)}</div><div className="text-xs text-muted">≈ {formatMinutes(Math.round(work / nDays))} / jour</div></div>
            <div className="card p-4"><div className="text-xs text-muted">dont cours</div><div className="font-display text-xl font-semibold">{formatMinutes(data.totals.TEACHING ?? 0)}</div></div>
            <div className="card p-4"><div className="text-xs text-muted">Repos et temps libre notés</div><div className="font-display text-xl font-semibold text-success">{formatMinutes(restMin)}</div></div>
            <div className="card p-4"><div className="text-xs text-muted">Objectif quotidien maximum</div><div className="font-display text-xl font-semibold">{data.settings.maxDailyHours} h</div><div className="text-xs text-muted">modifiable dans Paramètres</div></div>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card title="Suivi des heures quotidiennes (h)" className="lg:col-span-2">
              <Bars data={chartDays} x="date" stacked xFormat={(d) => shortDate(d).slice(0, 5)} series={cats.map(([k, c]) => ({ key: k, label: c.label, color: c.color }))} height={280} />
            </Card>
            <Card title={period === "week" ? "Bilan hebdomadaire" : "Bilan de la période"}>
              <ul className="space-y-2 text-sm">
                {cats.map(([k, c]) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="flex-1 text-ink-2">{c.label}</span>
                    <span className="tabular-nums">{formatMinutes(data.totals[k] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <Card title="Charge de travail des 7 prochains jours" icon={<Gauge className="h-4 w-4" />} action={<Button size="sm" variant="soft" onClick={() => setRest({ date: t, startTime: "15:00", endTime: "15:20" })}><Coffee className="h-4 w-4" />Programmer une pause</Button>}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {data.forecast.map((d) => (
                <div key={d.date} className={cn("rounded-2xl border border-line p-3", d.date === t && "ring-2 ring-accent")}>
                  <div className="flex items-center justify-between"><span className="text-sm font-medium capitalize">{dayName(d.date).slice(0, 3)}. {shortDate(d.date).slice(0, 5)}</span><Badge tone={LOAD_TONE[d.load]}>{LOAD_LABELS[d.load]}</Badge></div>
                  <div className="mt-2 h-2 rounded-full bg-surface-2"><div className={cn("h-2 rounded-full", d.load === "OVERLOADED" ? "bg-danger" : d.load === "BUSY" ? "bg-warning" : "bg-primary-strong")} style={{ width: `${Math.min(100, (d.teachingMinutes / (data.settings.maxDailyHours * 60)) * 100)}%` }} /></div>
                  <div className="mt-1 text-xs text-muted">{d.sessions} cours · {formatMinutes(d.teachingMinutes)}{d.restMinutes ? ` · repos ${formatMinutes(d.restMinutes)}` : ""}</div>
                  {d.breaks.length > 0 && <div className="mt-1 text-xs text-warning">⚠ pause courte après {d.breaks.map((b) => b.after).join(", ")}</div>}
                  {d.free.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {d.free.map((f) => <button key={f.startTime} onClick={() => setRest({ date: d.date, startTime: f.startTime, endTime: f.endTime })} className="chip bg-success-soft text-success" title="Bloquer pour du repos">{f.startTime}–{f.endTime}</button>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Les créneaux verts sont libres : cliquez pour les réserver au repos. Les cours ne peuvent pas être programmés sur une période déjà occupée sans confirmation.</p>
          </Card>
          <Card title="Noter du temps" icon={<Timer className="h-4 w-4" />}>
            <div className="grid gap-2 sm:grid-cols-[150px_200px_120px_1fr_auto] sm:items-end">
              <Field label="Date"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
              <Field label="Activité"><Select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} options={MANUAL} /></Field>
              <Field label="Minutes"><Input type="number" min={1} step={5} value={v.minutes} onChange={(e) => setV({ ...v, minutes: e.target.value })} /></Field>
              <Field label="Note"><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
              <Button onClick={add} disabled={!(Number(v.minutes) > 0)}><Plus className="h-4 w-4" />Ajouter</Button>
            </div>
            <p className="mt-2 text-xs text-muted">Le temps de cours est compté automatiquement à partir des séances effectuées.</p>
            {data.entries.length === 0 ? <Empty title="Aucune saisie sur la période" /> : (
              <ul className="mt-3 divide-y divide-line text-sm">
                {data.entries.slice(0, 40).map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-1.5">
                    <span className="w-20 text-muted">{shortDate(e.date).slice(0, 5)}</span>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: TIME_CATEGORIES[e.category as keyof typeof TIME_CATEGORIES]?.color }} />
                    <span className="flex-1">{TIME_CATEGORIES[e.category as keyof typeof TIME_CATEGORIES]?.label}{e.note && <span className="text-muted"> — {e.note}</span>}</span>
                    <span className="tabular-nums">{formatMinutes(e.minutes)}</span>
                    <button onClick={() => del(e.id)} className="text-muted hover:text-danger" aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      {rest && <PersonalEventDialog draft={rest} onClose={() => { setRest(null); mutate(); }} />}
    </div>
  );
}
