"use client";
import Link from "next/link";
import { useState } from "react";
import {
  AlarmClock, BookOpen, CalendarCheck, CalendarDays, CheckSquare, Clock, Coffee, CreditCard, GraduationCap, HandCoins, ListChecks, PiggyBank, TrendingUp, TriangleAlert, Users, Wallet,
} from "lucide-react";
import { fullName, useApi } from "@/lib/client";
import { formatDT } from "@/lib/money";
import { formatMinutes, longDate, nowParts, shortDate, shortMonth } from "@/lib/dates";
import { LOAD_LABELS } from "@/lib/schedule";
import type { PersonalEvent, Session, Tx } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Loading, Stat } from "@/components/ui";
import { Money, StatusBadge, SubjectDot, TxBadge } from "@/components/shared";
import { Bars } from "@/components/charts";
import { SessionDetail } from "@/components/SessionDetail";

type D = {
  today: string; now: string; teacherName: string;
  kpis: Record<string, number> & { todayLoad: keyof typeof LOAD_LABELS };
  todaySessions: Session[]; todayEvents: PersonalEvent[]; freeToday: { startTime: string; endTime: string; minutes: number }[];
  nextSessions: Session[]; lastTransactions: Tx[]; latePayers: { id: string; name: string; due: number; since: string; days: number }[];
  unprepared: Session[]; draftLessons: { id: string; title: string; chapter: { title: string; subject: { name: string; color: string } } }[];
  urgentTasks: { id: string; title: string; priority: string; dueDate: string | null }[];
  deadlines: { id: string; kind: "homework" | "task"; title: string; date: string; detail: string }[];
  revenueMonths: { month: string; revenue: number }[]; hoursWeeks: { week: string; hours: number }[];
};

const who = (s: Session) => s.title || s.participants.map((p) => fullName(p.student)).join(", ");

function greeting(name: string) {
  const h = Number(nowParts().time.slice(0, 2));
  return `${h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir"} ${name} 👋`;
}

export default function Dashboard() {
  const { data, error, mutate } = useApi<D>("/api/dashboard", { refreshInterval: 60_000 });
  const [open, setOpen] = useState<string | null>(null);
  if (error) return <ErrorBox error={error} retry={() => mutate()} />;
  if (!data) return <Loading rows={6} />;
  const k = data.kpis;
  const loadTone = { LIGHT: "success", NORMAL: "info", BUSY: "warning", OVERLOADED: "danger" }[k.todayLoad];
  const timeline = [
    ...data.todaySessions.map((s) => ({ kind: "s" as const, start: s.startTime, end: s.endTime, s })),
    ...data.todayEvents.map((e) => ({ kind: "e" as const, start: e.startTime, end: e.endTime, e })),
  ].sort((a, b) => (a.start < b.start ? -1 : 1));

  return (
    <div className="space-y-5">
      <div className="card relative overflow-hidden bg-gradient-to-br from-primary-soft via-surface to-accent-soft/60 p-5 sm:p-6">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm capitalize text-muted">{longDate(data.today)}</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">{greeting(data.teacherName)}</h1>
            <p className="mt-1.5 max-w-xl text-sm text-ink-2">
              {k.sessionsToday ? `${k.sessionsToday} cours aujourd'hui` : "Aucun cours aujourd'hui"} · journée <b>{LOAD_LABELS[k.todayLoad].toLowerCase()}</b> · {formatMinutes(k.freeMinutesToday)} de temps libre restant
              {data.unprepared.length > 0 && ` · ${data.unprepared.length} séance(s) à préparer cette semaine`}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/semaine"><Button variant="secondary"><CalendarDays className="h-4 w-4" />Organiser ma semaine</Button></Link>
            <Link href="/seances?new=1"><Button>Nouvelle séance</Button></Link>
          </div>
        </div>
        <GraduationCap className="absolute -bottom-6 -right-4 h-40 w-40 text-primary/15" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Élèves (total)" value={k.students} icon={<Users className="h-5 w-5" />} hint={`${k.activeStudents} actifs`} href="/eleves" />
        <Stat label="Élèves actifs" value={k.activeStudents} icon={<GraduationCap className="h-5 w-5" />} tone="success" href="/eleves" />
        <Stat label="Séances aujourd'hui" value={k.sessionsToday} icon={<CalendarCheck className="h-5 w-5" />} tone="accent" hint={<Badge tone={loadTone}>Charge {LOAD_LABELS[k.todayLoad].toLowerCase()}</Badge>} href="/calendrier" />
        <Stat label="Séances cette semaine" value={k.sessionsWeek} icon={<CalendarDays className="h-5 w-5" />} href="/semaine" />
        <Stat label="Heures travaillées (semaine)" value={`${k.hoursWorkedWeek} h`} icon={<Clock className="h-5 w-5" />} hint={`dont ${k.teachingHoursWeek} h de cours`} href="/temps" />
        <Stat label="Séances effectuées (mois)" value={k.sessionsDoneMonth} icon={<CheckSquare className="h-5 w-5" />} tone="success" href="/seances" />
        <Stat label="Revenus encaissés (mois)" value={formatDT(k.revenueMonth)} icon={<TrendingUp className="h-5 w-5" />} tone="success" hint={`Aujourd'hui : ${formatDT(k.revenueToday)}`} href="/finances" />
        <Stat label="Paiements en attente" value={formatDT(k.pendingTotal)} icon={<HandCoins className="h-5 w-5" />} tone={k.pendingTotal > 0 ? "danger" : "muted"} href="/finances?status=DUE" />
        <Stat label="Avances disponibles" value={formatDT(k.creditTotal)} icon={<PiggyBank className="h-5 w-5" />} tone="info" hint="non comptées en revenus" href="/finances?status=CREDIT" />
        <Stat label="Tâches à terminer" value={k.tasksOpen} icon={<ListChecks className="h-5 w-5" />} tone="warning" href="/taches" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Mon planning du jour" icon={<CalendarCheck className="h-4 w-4" />} className="xl:col-span-2" action={<Link href="/calendrier" className="text-xs text-primary-strong hover:underline">Calendrier</Link>}>
          {timeline.length === 0 ? (
            <Empty title="Journée libre" icon={<Coffee className="h-6 w-6" />}>Aucun cours ni événement aujourd&apos;hui.</Empty>
          ) : (
            <ol className="relative space-y-2 border-l-2 border-line pl-4">
              {timeline.map((it, i) => {
                const past = it.end <= data.now;
                return (
                  <li key={i} className={past ? "opacity-60" : ""}>
                    <span className={`absolute -left-[7px] mt-3 h-3 w-3 rounded-full border-2 border-surface ${it.kind === "s" ? "bg-primary-strong" : "bg-success"}`} />
                    {it.kind === "s" ? (
                      <button onClick={() => setOpen(it.s.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:bg-surface-2/60">
                        <span className="w-24 text-sm font-semibold tabular-nums">{it.start}–{it.end}</span>
                        <SubjectDot color={it.s.subject?.color} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{who(it.s)}</span>
                        <span className="text-xs text-muted">{it.s.subject?.name}{it.s.location ? ` · ${it.s.location}` : ""}</span>
                        <StatusBadge status={it.s.status} />
                        {!it.s.prepared && it.s.status === "PLANNED" && <Badge tone="warning">À préparer</Badge>}
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-success-soft/50 px-3 py-2">
                        <span className="w-24 text-sm font-semibold tabular-nums">{it.start}–{it.end}</span>
                        <span className="text-sm">{it.e.title}</span>
                        <Badge tone="success">{it.e.kind === "REST" ? "Repos" : it.e.kind === "BREAK" ? "Pause" : "Personnel"}</Badge>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {data.freeToday.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <Coffee className="h-3.5 w-3.5" />Créneaux libres :
              {data.freeToday.map((f) => <Badge key={f.startTime} tone="success">{f.startTime}–{f.endTime}</Badge>)}
            </div>
          )}
        </Card>

        <Card title="Mes prochains cours" icon={<AlarmClock className="h-4 w-4" />} href="/seances">
          {data.nextSessions.length === 0 ? <Empty title="Aucun cours programmé" /> : (
            <ul className="space-y-2">
              {data.nextSessions.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setOpen(s.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2/60">
                    <div className="w-14 shrink-0 rounded-lg bg-primary-soft py-1 text-center text-[11px] font-semibold leading-tight text-primary-strong">
                      {shortDate(s.date).slice(0, 5)}<br />{s.startTime}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{who(s)}</div>
                      <div className="truncate text-xs text-muted">{s.subject?.name ?? "—"}{s.chapter ? ` · ${s.chapter}` : ""}</div>
                    </div>
                    {!s.prepared && <span className="h-2 w-2 rounded-full bg-warning" title="À préparer" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Revenus encaissés — 12 derniers mois" icon={<TrendingUp className="h-4 w-4" />} href="/finances">
          <Bars data={data.revenueMonths} x="month" series={[{ key: "revenue", label: "Revenus", color: "var(--s1)" }]} money xFormat={shortMonth} />
        </Card>
        <Card title="Heures de cours — 8 dernières semaines" icon={<Clock className="h-4 w-4" />} href="/temps">
          <Bars data={data.hoursWeeks} x="week" series={[{ key: "hours", label: "Heures", color: "var(--s3)" }]} xFormat={(w) => shortDate(w).slice(0, 5)} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Paiements en retard" icon={<TriangleAlert className="h-4 w-4" />} href="/finances?status=LATE">
          {data.latePayers.length === 0 ? <Empty title="Aucun retard de paiement 🎉" /> : (
            <ul className="divide-y divide-line">
              {data.latePayers.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/eleves/${l.id}?tab=solde`} className="min-w-0">
                    <div className="truncate text-sm font-medium hover:underline">{l.name}</div>
                    <div className="text-xs text-muted">depuis le {shortDate(l.since)} ({l.days} j)</div>
                  </Link>
                  <Money value={l.due} tone="due" strong />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Mes dernières transactions" icon={<Wallet className="h-4 w-4" />} href="/finances/journal">
          {data.lastTransactions.length === 0 ? <Empty title="Aucune opération" /> : (
            <ul className="divide-y divide-line">
              {data.lastTransactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{t.student && fullName(t.student)}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted"><TxBadge type={t.type} />{shortDate(t.date)}</div>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{formatDT(Number(t.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Préparations de cours à terminer" icon={<BookOpen className="h-4 w-4" />} href="/preparations">
          {data.unprepared.length + data.draftLessons.length === 0 ? <Empty title="Tout est prêt ✔" /> : (
            <ul className="space-y-1.5">
              {data.unprepared.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setOpen(s.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2/60">
                    <Badge tone="warning">{shortDate(s.date).slice(0, 5)} {s.startTime}</Badge>
                    <span className="truncate">{who(s)}{s.chapter ? ` — ${s.chapter}` : ""}</span>
                  </button>
                </li>
              ))}
              {data.draftLessons.map((l) => (
                <li key={l.id}>
                  <Link href={`/preparations?lesson=${l.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2/60">
                    <SubjectDot color={l.chapter.subject.color} />
                    <span className="truncate">Leçon en brouillon : {l.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Mes tâches urgentes" icon={<ListChecks className="h-4 w-4" />} href="/taches">
          {data.urgentTasks.length === 0 ? <Empty title="Aucune tâche urgente" /> : (
            <ul className="space-y-1.5">
              {data.urgentTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm">
                  <span className="truncate">{t.title}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {t.dueDate && <span className={`text-xs ${t.dueDate < data.today ? "text-danger" : "text-muted"}`}>{shortDate(t.dueDate).slice(0, 5)}</span>}
                    <Badge tone={t.priority === "URGENT" ? "danger" : "warning"}>{t.priority === "URGENT" ? "Urgente" : "Haute"}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Mes prochaines échéances" icon={<CreditCard className="h-4 w-4" />} className="xl:col-span-2">
          {data.deadlines.length === 0 ? <Empty title="Aucune échéance dans les 7 prochains jours" /> : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {data.deadlines.map((d) => (
                <li key={d.kind + d.id}>
                  <Link href={d.kind === "homework" ? "/devoirs" : "/taches"} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:bg-surface-2/60">
                    <Badge tone={d.date < data.today ? "danger" : d.date === data.today ? "warning" : "info"}>{shortDate(d.date).slice(0, 5)}</Badge>
                    <span className="min-w-0 flex-1 truncate">{d.title}</span>
                    <span className="truncate text-xs text-muted">{d.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <SessionDetail id={open} onClose={() => { setOpen(null); mutate(); }} />
    </div>
  );
}
