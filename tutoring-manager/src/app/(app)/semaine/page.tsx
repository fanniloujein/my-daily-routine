"use client";
import { useState } from "react";
import { AlertTriangle, CalendarRange, ChevronLeft, ChevronRight, Coffee, Info, Lightbulb, Plus, Printer } from "lucide-react";
import { fullName, useApi } from "@/lib/client";
import { addDays, dayName, formatMinutes, shortDate, startOfWeek, today } from "@/lib/dates";
import { cn } from "@/lib/client";
import type { PersonalEvent, Session, Task } from "@/lib/types";
import { Badge, Button, Card, ErrorBox, Loading, PageHeader } from "@/components/ui";
import { SubjectDot } from "@/components/shared";
import { SessionDetail } from "@/components/SessionDetail";
import { SessionForm, type SessionDraft } from "@/components/SessionForm";

type Day = {
  date: string; sessions: Session[]; events: PersonalEvent[]; tasks: Task[]; availability: { startTime: string; endTime: string }[];
  teachingMinutes: number; load: "LIGHT" | "NORMAL" | "BUSY" | "OVERLOADED"; free: { startTime: string; endTime: string; minutes: number }[];
  breaks: { after: string; gap: number }[]; conflicts: [string, string][]; unprepared: number;
};
type W = { weekStart: string; weekEnd: string; days: Day[]; students: { id: string; name: string; count: number }[]; totals: { sessions: number; teachingHours: number; unprepared: number; expectedRevenueLabel: string }; suggestions: { tone: "info" | "warning" | "danger"; text: string }[]; loadLabels: Record<string, string> };

const LOAD_STYLE = { LIGHT: "bg-success-soft text-success", NORMAL: "bg-primary-soft text-primary-strong", BUSY: "bg-warning-soft text-warning", OVERLOADED: "bg-danger-soft text-danger" };

export default function WeekPage() {
  const [week, setWeek] = useState(startOfWeek(today()));
  const { data, error, mutate } = useApi<W>(`/api/week?week=${week}`);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const t = today();

  return (
    <div>
      <PageHeader
        title="Organiser ma semaine"
        icon={<CalendarRange className="h-5 w-5" />}
        subtitle={data ? `Du ${shortDate(data.weekStart)} au ${shortDate(data.weekEnd)}` : "…"}
        actions={
          <>
            <Button variant="secondary" size="icon" onClick={() => setWeek(addDays(week, -7))} aria-label="Semaine précédente"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="secondary" onClick={() => setWeek(startOfWeek(today()))}>Cette semaine</Button>
            <Button variant="secondary" size="icon" onClick={() => setWeek(addDays(week, 7))} aria-label="Semaine suivante"><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => window.print()} title="Imprimer"><Printer className="h-4 w-4" /></Button>
          </>
        }
      />
      {error ? <ErrorBox error={error} retry={() => mutate()} /> : !data ? <Loading rows={6} /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Séances", data.totals.sessions], ["Heures de cours", `${data.totals.teachingHours} h`], ["À préparer", data.totals.unprepared], ["Revenus prévus", data.totals.expectedRevenueLabel]].map(([l, v]) => (
              <div key={String(l)} className="card p-4"><div className="text-xs text-muted">{l}</div><div className="mt-0.5 font-display text-xl font-semibold">{v}</div></div>
            ))}
          </div>

          {data.suggestions.length > 0 && (
            <Card title="Suggestions pour équilibrer la semaine" icon={<Lightbulb className="h-4 w-4" />}>
              <ul className="space-y-1.5 text-sm">
                {data.suggestions.map((s, i) => (
                  <li key={i} className={cn("flex items-start gap-2 rounded-xl px-3 py-2", s.tone === "danger" ? "bg-danger-soft text-danger" : s.tone === "warning" ? "bg-warning-soft text-ink" : "bg-primary-soft/60 text-ink")}>
                    {s.tone === "info" ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}{s.text}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {data.days.map((d) => {
              const conflictIds = new Set(d.conflicts.flat());
              const items = [...d.sessions.map((s) => ({ k: "s" as const, start: s.startTime, s })), ...d.events.map((e) => ({ k: "e" as const, start: e.startTime, e }))].sort((a, b) => (a.start < b.start ? -1 : 1));
              return (
                <div key={d.date} className={cn("card flex flex-col p-3", d.date === t && "ring-2 ring-accent")}>
                  <div className="mb-2 flex items-start justify-between gap-1">
                    <div>
                      <div className="text-sm font-semibold capitalize">{dayName(d.date)}</div>
                      <div className="text-xs text-muted">{shortDate(d.date)}</div>
                    </div>
                    <span className={cn("chip", LOAD_STYLE[d.load])}>{data.loadLabels[d.load]}</span>
                  </div>
                  <div className="mb-2 text-xs text-muted">{formatMinutes(d.teachingMinutes)} de cours</div>
                  <div className="flex-1 space-y-1.5">
                    {items.length === 0 && <p className="py-2 text-center text-xs text-muted">Libre</p>}
                    {items.map((it, i) =>
                      it.k === "s" ? (
                        <button key={i} onClick={() => setOpen(it.s.id)} className={cn("block w-full rounded-lg border-l-4 bg-surface-2/60 px-2 py-1.5 text-left text-xs", ["CANCELLED", "POSTPONED", "TEACHER_ABSENT"].includes(it.s.status) && "opacity-50 line-through", conflictIds.has(it.s.id) && "ring-2 ring-danger")} style={{ borderLeftColor: it.s.subject?.color ?? "#8fb8e8" }}>
                          <div className="font-semibold tabular-nums">{it.s.startTime}–{it.s.endTime}</div>
                          <div className="truncate">{it.s.title || it.s.participants.map((p) => fullName(p.student)).join(", ")}</div>
                          <div className="flex items-center gap-1 text-muted"><SubjectDot color={it.s.subject?.color} className="h-2 w-2" />{it.s.subject?.name ?? "—"}{!it.s.prepared && it.s.status === "PLANNED" && <span className="ml-auto text-warning">à préparer</span>}</div>
                        </button>
                      ) : (
                        <div key={i} className="rounded-lg bg-success-soft/50 px-2 py-1.5 text-xs">
                          <div className="font-semibold tabular-nums">{it.e.startTime}–{it.e.endTime}</div>
                          <div className="flex items-center gap-1 truncate"><Coffee className="h-3 w-3" />{it.e.title}</div>
                        </div>
                      ),
                    )}
                    {d.tasks.map((k) => <div key={k.id} className="truncate rounded-lg bg-accent-soft/60 px-2 py-1 text-xs">☐ {k.title}</div>)}
                  </div>
                  {d.free.length > 0 && (
                    <div className="mt-2 border-t border-line pt-2">
                      <div className="mb-1 text-[11px] text-muted">Créneaux libres</div>
                      <div className="flex flex-wrap gap-1">
                        {d.free.slice(0, 3).map((f) => (
                          <button key={f.startTime} onClick={() => setDraft({ date: d.date, startTime: f.startTime })} className="chip bg-success-soft text-success hover:opacity-80" title="Programmer une séance ici">
                            <Plus className="h-3 w-3" />{f.startTime}–{f.endTime}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Card title={`Élèves à recevoir cette semaine (${data.students.length})`}>
            {data.students.length === 0 ? <p className="text-sm text-muted">Aucun élève cette semaine.</p> : (
              <div className="flex flex-wrap gap-2">{data.students.map((s) => <Badge key={s.id} tone="info">{s.name}{s.count > 1 ? ` ×${s.count}` : ""}</Badge>)}</div>
            )}
          </Card>
        </div>
      )}
      <SessionDetail id={open} onClose={() => { setOpen(null); mutate(); }} />
      <SessionForm open={!!draft} onClose={() => { setDraft(null); mutate(); }} draft={draft ?? undefined} />
    </div>
  );
}
