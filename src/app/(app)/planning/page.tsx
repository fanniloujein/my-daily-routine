"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Feather, Plus, Wand2 } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader, Segmented, useUi } from "@/components/ui";
import { ActivityItem } from "@/components/activity/ActivityItem";
import { useActivityEditor } from "@/components/activity/ActivityEditorContext";
import { draftFromOccurrence } from "@/components/activity/ActivityForm";
import { PlanDialog } from "@/components/PlanDialog";
import { BulkBar, SelectBox } from "@/components/activity/BulkBar";
import { ApiError, api, cx, fmtDateLong, refreshAll } from "@/lib/client";
import { useCategories, useOccurrences, type Occurrence } from "@/lib/hooks";
import { addDays, addMonths, endOfMonth, formatTime, minToTime, rangeDays, startOfMonth, startOfWeek, timeToMin, today } from "@/lib/dates";
import { findConflicts } from "@/lib/conflicts";

type View = "day" | "week" | "month" | "list" | "urgent";

export default function PlanningPage() {
  const [view, setView] = useState<View>("day");
  const [cursor, setCursor] = useState(today());
  const [plan, setPlan] = useState<{ light: boolean } | null>(null);
  const editor = useActivityEditor();
  const t = today();

  const range = useMemo(() => {
    switch (view) {
      case "day":
        return { from: cursor, to: cursor };
      case "week":
        return { from: startOfWeek(cursor), to: addDays(startOfWeek(cursor), 6) };
      case "month":
        return { from: startOfWeek(startOfMonth(cursor)), to: addDays(startOfWeek(endOfMonth(cursor)), 6) };
      case "list":
        return { from: cursor, to: addDays(cursor, 30) };
      case "urgent":
        return { from: addDays(t, -14), to: addDays(t, 7) };
    }
  }, [view, cursor, t]);

  const { data, error, isLoading, mutate } = useOccurrences(range.from, range.to);

  function step(n: number) {
    if (view === "day") setCursor(addDays(cursor, n));
    else if (view === "week") setCursor(addDays(cursor, 7 * n));
    else if (view === "month") setCursor(addMonths(cursor, n));
    else if (view === "list") setCursor(addDays(cursor, 30 * n));
  }

  const title =
    view === "day"
      ? fmtDateLong(cursor)
      : view === "week"
        ? `Semaine du ${fmtDateLong(range.from).replace(/^\w+ /, "")}`
        : view === "month"
          ? new Date(cursor + "T12:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
          : view === "list"
            ? "30 prochains jours"
            : "Activités urgentes et en retard";

  return (
    <div>
      <PageHeader
        title="Planning"
        subtitle="Ajoute, déplace, reporte : tout reste modifiable."
        actions={
          <>
            <Button variant="secondary" onClick={() => setPlan({ light: true })}>
              <Feather className="h-4 w-4" /> Journée légère
            </Button>
            <Button variant="secondary" onClick={() => setPlan({ light: false })}>
              <Wand2 className="h-4 w-4" /> Organiser {view === "day" && cursor !== t ? "ce jour" : "ma journée"}
            </Button>
            <Button onClick={() => editor.open({ date: view === "day" ? cursor : t })}>
              <Plus className="h-4 w-4" /> Activité
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "day", label: "Jour" },
            { value: "week", label: "Semaine" },
            { value: "month", label: "Mois" },
            { value: "list", label: "Liste" },
            { value: "urgent", label: "Urgent" },
          ]}
        />
        {view !== "urgent" && (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => step(-1)} aria-label="Précédent">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCursor(t)}>
              Aujourd&apos;hui
            </Button>
            <Button size="icon" variant="ghost" onClick={() => step(1)} aria-label="Suivant">
              <ChevronRight className="h-5 w-5" />
            </Button>
            <input type="date" className="input ml-1 h-9 w-auto py-1" value={cursor} onChange={(e) => e.target.value && setCursor(e.target.value)} aria-label="Aller à la date" />
          </div>
        )}
      </div>
      <h2 className="mb-3 font-display text-lg font-semibold first-letter:uppercase text-ink">{title}</h2>

      {error ? (
        <ErrorBox error={error} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Loading />
      ) : (
        <>
          {view === "day" && <DayView date={cursor} items={data ?? []} />}
          {view === "week" && <WeekView from={range.from} items={data ?? []} onPickDay={(d) => { setCursor(d); setView("day"); }} />}
          {view === "month" && <MonthView cursor={cursor} from={range.from} to={range.to} items={data ?? []} onPickDay={(d) => { setCursor(d); setView("day"); }} />}
          {view === "list" && <ListView items={data ?? []} />}
          {view === "urgent" && <UrgentView items={data ?? []} />}
        </>
      )}
      {plan && <PlanDialog open onClose={() => setPlan(null)} date={view === "day" ? cursor : t} light={plan.light} />}
      <p className="mt-6 text-xs text-muted">Astuce : en vue Semaine, fais glisser une activité vers un autre jour pour la déplacer (sur ordinateur).</p>
    </div>
  );
}

const HOUR_PX = 56;
const START_H = 6;
const END_H = 24;

function layoutColumns(items: Occurrence[]) {
  // Répartit les éléments qui se chevauchent sur plusieurs colonnes
  const sorted = [...items].sort((a, b) => timeToMin(a.startTime!) - timeToMin(b.startTime!));
  const cols: Occurrence[][] = [];
  const pos = new Map<string, { col: number; cols: number }>();
  let group: Occurrence[] = [];
  let groupEnd = -1;
  const flush = () => {
    const n = Math.max(1, ...group.map((g) => pos.get(g.key)!.col + 1));
    for (const g of group) pos.set(g.key, { ...pos.get(g.key)!, cols: n });
    group = [];
    cols.length = 0;
  };
  for (const o of sorted) {
    const s = timeToMin(o.startTime!);
    if (s >= groupEnd && group.length) flush();
    let c = cols.findIndex((col) => timeToMin(col[col.length - 1].endTime!) <= s);
    if (c === -1) {
      cols.push([o]);
      c = cols.length - 1;
    } else cols[c].push(o);
    pos.set(o.key, { col: c, cols: 1 });
    group.push(o);
    groupEnd = Math.max(groupEnd, timeToMin(o.endTime!));
  }
  if (group.length) flush();
  return pos;
}

function DayView({ date, items }: { date: string; items: Occurrence[] }) {
  const editor = useActivityEditor();
  const timed = items.filter((o) => o.startTime && o.endTime && o.date === date);
  const untimed = items.filter((o) => !o.startTime && o.date === date);
  const conflicts = findConflicts(timed.filter((o) => o.status !== "DONE" && o.status !== "POSTPONED"));
  const pos = layoutColumns(timed);
  const isToday = date === today();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2" bodyClass="p-0 sm:p-0">
        {conflicts.length > 0 && (
          <div className="m-3 flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Chevauchement : {conflicts.map(([a, b]) => `« ${a.title} » et « ${b.title} »`).join(", ")}. Déplace l&apos;une des activités si besoin.
            </span>
          </div>
        )}
        <div className="relative max-h-[70vh] overflow-y-auto" style={{ scrollBehavior: "smooth" }}>
          <div className="relative" style={{ height: (END_H - START_H) * HOUR_PX }}>
            {Array.from({ length: END_H - START_H }, (_, i) => (
              <button
                key={i}
                className="absolute left-0 right-0 border-t border-line/60 text-left hover:bg-primary-soft/30"
                style={{ top: i * HOUR_PX, height: HOUR_PX }}
                onClick={() => editor.open({ date, startTime: minToTime((START_H + i) * 60), endTime: minToTime((START_H + i) * 60 + 60), durationMin: 60 })}
                aria-label={`Ajouter à ${START_H + i} h`}
              >
                <span className="absolute -top-2 left-2 bg-surface px-1 text-[10px] text-muted">{START_H + i} h</span>
              </button>
            ))}
            {isToday && nowMin >= START_H * 60 && (
              <div className="pointer-events-none absolute left-12 right-2 z-10 border-t-2 border-danger" style={{ top: ((nowMin - START_H * 60) / 60) * HOUR_PX }}>
                <span className="absolute -left-1.5 -top-[5px] h-2 w-2 rounded-full bg-danger" />
              </div>
            )}
            {timed.map((o) => {
              const s = Math.max(timeToMin(o.startTime!), START_H * 60);
              const e = timeToMin(o.endTime!);
              const p = pos.get(o.key)!;
              const width = `calc((100% - 3.5rem) / ${p.cols})`;
              return (
                <button
                  key={o.key}
                  onClick={() => editor.open(draftFromOccurrence(o))}
                  className={cx(
                    "absolute overflow-hidden rounded-xl border-l-4 px-2 py-1 text-left text-xs shadow-sm transition hover:z-20 hover:shadow-card",
                    o.status === "DONE" && "opacity-55",
                  )}
                  style={{
                    top: ((s - START_H * 60) / 60) * HOUR_PX + 1,
                    height: Math.max(22, ((e - s) / 60) * HOUR_PX - 2),
                    left: `calc(3rem + ${width} * ${p.col})`,
                    width: `calc(${width} - 4px)`,
                    background: `${o.category.color}24`,
                    borderLeftColor: o.category.color,
                  }}
                >
                  <div className={cx("truncate font-medium text-ink", o.status === "DONE" && "line-through")}>{o.title}</div>
                  <div className="truncate text-[10px] text-ink-2">
                    {formatTime(o.startTime)} – {formatTime(o.endTime)} {o.isFixed ? "· fixe" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Card>
      <div className="space-y-5">
        <Card title={`Sans horaire (${untimed.length})`}>
          {untimed.length === 0 ? <p className="text-sm text-muted">Aucune tâche flexible.</p> : untimed.map((o) => <ActivityItem key={o.key} o={o} compact />)}
        </Card>
        <Card title={`Avec horaire (${timed.length})`}>
          {timed.length === 0 ? <p className="text-sm text-muted">Rien de programmé.</p> : timed.map((o) => <ActivityItem key={o.key} o={o} compact />)}
        </Card>
      </div>
    </div>
  );
}

function WeekView({ from, items, onPickDay }: { from: string; items: Occurrence[]; onPickDay: (d: string) => void }) {
  const { toast } = useUi();
  const days = rangeDays(from, addDays(from, 6));
  const t = today();
  const [over, setOver] = useState<string | null>(null);

  async function drop(day: string, key: string) {
    const o = items.find((x) => x.key === key);
    if (!o || o.date === day) return;
    try {
      await api(`/api/activities/${o.id}/occurrence`, { body: { action: "move", date: o.originalDate, newDate: day } });
      await refreshAll();
      toast("Activité déplacée");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) toast("Conflit d'horaire ce jour-là : utilise « Déplacer… » pour choisir une autre heure.", "warning");
      else toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }

  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((d) => {
        const list = items.filter((o) => o.date === d);
        const load = list.filter((o) => o.status !== "DONE").reduce((s, o) => s + o.durationMin, 0);
        return (
          <div
            key={d}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(d);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              setOver(null);
              drop(d, e.dataTransfer.getData("text/plain"));
            }}
            className={cx("card min-h-[8rem] p-2 transition", d === t && "ring-2 ring-primary/40", over === d && "bg-primary-soft/40")}
          >
            <button onClick={() => onPickDay(d)} className="mb-2 flex w-full items-baseline justify-between px-1 text-left">
              <span className="text-xs font-semibold first-letter:uppercase text-ink">{new Date(d + "T12:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}</span>
              <span className={cx("text-[10px]", load > 480 ? "text-warning" : "text-muted")}>{load ? `${Math.round(load / 6) / 10} h` : ""}</span>
            </button>
            <div className="space-y-1">
              {list.length === 0 && <p className="px-1 text-[11px] text-muted">Libre</p>}
              {list.map((o) => (
                <div
                  key={o.key}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", o.key)}
                  className={cx("cursor-grab rounded-lg border-l-[3px] px-1.5 py-1 text-[11px] active:cursor-grabbing", o.status === "DONE" && "opacity-50 line-through")}
                  style={{ background: `${o.category.color}1f`, borderLeftColor: o.category.color }}
                  title={o.title}
                >
                  <div className="truncate font-medium text-ink">{o.title}</div>
                  <div className="text-[10px] text-ink-2">{o.startTime ? formatTime(o.startTime) : "sans horaire"}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ cursor, from, to, items, onPickDay }: { cursor: string; from: string; to: string; items: Occurrence[]; onPickDay: (d: string) => void }) {
  const days = rangeDays(from, to);
  const month = cursor.slice(0, 7);
  const t = today();
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line/70 bg-surface-2/50 text-center text-[11px] font-medium text-muted">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = items.filter((o) => o.date === d);
          return (
            <button
              key={d}
              onClick={() => onPickDay(d)}
              className={cx("min-h-[4.5rem] border-b border-r border-line/50 p-1 text-left align-top transition hover:bg-surface-2/60 sm:min-h-[6rem]", d.slice(0, 7) !== month && "opacity-40")}
            >
              <span className={cx("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", d === t ? "bg-primary text-white dark:text-[#0e1322]" : "text-ink-2")}>{Number(d.slice(8))}</span>
              <div className="mt-0.5 hidden space-y-0.5 sm:block">
                {list.slice(0, 3).map((o) => (
                  <div key={o.key} className="truncate rounded px-1 text-[10px] text-ink" style={{ background: `${o.category.color}22` }}>
                    {o.startTime ? `${formatTime(o.startTime)} ` : ""}
                    {o.title}
                  </div>
                ))}
                {list.length > 3 && <div className="px-1 text-[10px] text-muted">+{list.length - 3}</div>}
              </div>
              <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                {list.slice(0, 4).map((o) => (
                  <span key={o.key} className="h-1.5 w-1.5 rounded-full" style={{ background: o.category.color }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ items }: { items: Occurrence[] }) {
  const { data: cats } = useCategories();
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState<"open" | "all" | "done">("open");
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const filtered = items.filter(
    (o) => (cat === "all" || o.categoryId === cat) && (status === "all" || (status === "open" ? o.status !== "DONE" : o.status === "DONE")),
  );
  const byDate = new Map<string, Occurrence[]>();
  for (const o of filtered) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);
  const t = today();
  const toggle = (k: string) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="input h-9 w-auto py-1" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtrer par catégorie">
          <option value="all">Toutes les catégories</option>
          {cats?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: "open", label: "À faire" },
            { value: "done", label: "Terminées" },
            { value: "all", label: "Toutes" },
          ]}
        />
        <Button size="sm" variant={selecting ? "soft" : "secondary"} className="ml-auto" onClick={() => { setSelecting(!selecting); setSel(new Set()); }}>
          {selecting ? "Terminer la sélection" : "Sélectionner plusieurs"}
        </Button>
      </div>
      {selecting && <BulkBar selected={filtered.filter((o) => sel.has(o.key))} all={filtered} onChange={setSel} />}
      {byDate.size === 0 && <Empty title="Aucune activité sur cette période" />}
      {[...byDate.entries()].map(([d, list]) => (
        <Card key={d} title={<span className="first-letter:uppercase">{d === t ? "Aujourd'hui" : fmtDateLong(d)}</span>}>
          {list.map((o) =>
            selecting ? (
              <div key={o.key} className="flex items-center gap-2">
                <SelectBox checked={sel.has(o.key)} onChange={() => toggle(o.key)} />
                <div className="min-w-0 flex-1">
                  <ActivityItem o={o} />
                </div>
              </div>
            ) : (
              <ActivityItem key={o.key} o={o} />
            ),
          )}
        </Card>
      ))}
    </div>
  );
}

function UrgentView({ items }: { items: Occurrence[] }) {
  const t = today();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const overdue = items.filter((o) => o.date < t && o.status !== "DONE" && o.status !== "POSTPONED" && !o.isRecurring);
  const urgent = items.filter(
    (o) => o.date >= t && o.status !== "DONE" && o.status !== "POSTPONED" && (o.priority >= 4 || (o.dueDate && o.dueDate <= addDays(t, 2))),
  );
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={<span className="flex items-center gap-2">En retard <Badge tone="warning">{overdue.length}</Badge></span>}>
        {overdue.length > 1 && <div className="mb-2"><BulkBar selected={overdue.filter((o) => sel.has(o.key))} all={overdue} onChange={setSel} /></div>}
        {overdue.length === 0 ? (
          <Empty title="Rien en retard 🎉" />
        ) : (
          overdue.map((o) => (
            <div key={o.key} className="flex items-center gap-2">
              {overdue.length > 1 && <SelectBox checked={sel.has(o.key)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(o.key)) n.delete(o.key); else n.add(o.key); return n; })} />}
              <div className="min-w-0 flex-1">
                <ActivityItem o={o} showDate />
              </div>
            </div>
          ))
        )}
        {overdue.length > 0 && <p className="mt-2 text-xs text-muted">Reporte-les en un clic, ou laisse « Organiser ma journée » les replacer.</p>}
      </Card>
      <Card title={<span className="flex items-center gap-2">Urgent / échéance proche <Badge tone="danger">{urgent.length}</Badge></span>}>
        {urgent.length === 0 ? <Empty title="Aucune urgence" /> : urgent.map((o) => <ActivityItem key={o.key} o={o} showDate />)}
      </Card>
    </div>
  );
}
