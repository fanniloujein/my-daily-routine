"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, ListChecks, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, cn, qsOf, useApi } from "@/lib/client";
import { PRIORITIES, TASK_CATEGORIES, TASK_STATUS } from "@/lib/constants";
import { addDays, addMonths, endOfMonth, formatMinutes, monthLabel, monthOf, rangeDates, shortDate, startOfWeek, today } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { Badge, Button, Dialog, Field, Input, Loading, PageHeader, Segmented, Select, Textarea, useConfirm } from "@/components/ui";

const PRIO_TONE = { LOW: "muted", MEDIUM: "info", HIGH: "warning", URGENT: "danger" } as const;
const COLS = ["TODO", "IN_PROGRESS", "POSTPONED", "DONE"] as const;

export default function TasksPage() {
  const [view, setView] = useState<"kanban" | "calendar">("kanban");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [edit, setEdit] = useState<Task | Partial<Task> | null>(null);
  const { data, mutate } = useApi<Task[]>(`/api/tasks${qsOf({ q, category })}`);
  const confirm = useConfirm();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const t = today();

  const cols = useMemo(() => Object.fromEntries(COLS.map((c) => [c, (data ?? []).filter((x) => x.status === c).sort((a, b) => a.order - b.order)])) as Record<(typeof COLS)[number], Task[]>, [data]);

  const drop = async (status: (typeof COLS)[number], beforeId: string | null) => {
    if (!drag || !data) return;
    const ids = cols[status].map((x) => x.id).filter((x) => x !== drag);
    const idx = beforeId ? ids.indexOf(beforeId) : -1;
    ids.splice(idx < 0 ? ids.length : idx, 0, drag);
    mutate(data.map((x) => (x.id === drag ? { ...x, status } : x)).map((x) => (ids.includes(x.id) ? { ...x, order: ids.indexOf(x.id) } : x)), false);
    setDrag(null);
    setOver(null);
    await api("/api/tasks/reorder", { body: { status, ids } });
    mutate();
  };
  const remove = async (k: Task) => { if ((await confirm({ title: `Supprimer « ${k.title} » ?`, danger: true })) !== false) { await api(`/api/tasks/${k.id}`, { method: "DELETE" }); mutate(); } };

  return (
    <div>
      <PageHeader title="Tâches" icon={<ListChecks className="h-5 w-5" />} subtitle="Organisation personnelle et professionnelle." actions={<Button onClick={() => setEdit({})}><Plus className="h-4 w-4" />Nouvelle tâche</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={view} onChange={setView} options={[{ value: "kanban", label: "Kanban" }, { value: "calendar", label: "Calendrier" }]} />
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" /></div>
        <Select className="w-auto" value={category} onChange={(e) => setCategory(e.target.value)} options={TASK_CATEGORIES} placeholder="Toutes catégories" />
      </div>
      {!data ? <Loading rows={5} /> : view === "kanban" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLS.map((c) => (
            <div key={c} onDragOver={(e) => { e.preventDefault(); setOver(c); }} onDragLeave={() => setOver(null)} onDrop={() => drop(c, null)} className={cn("flex min-h-[200px] flex-col rounded-2xl border border-line bg-surface-2/50 p-2.5 transition", over === c && "border-primary-strong bg-primary-soft/40")}>
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="section-title">{TASK_STATUS[c]}</h3>
                <span className="text-xs text-muted">{cols[c].length}</span>
              </div>
              <div className="flex-1 space-y-2">
                {cols[c].map((k) => (
                  <div key={k.id} draggable onDragStart={() => setDrag(k.id)} onDragEnd={() => setDrag(null)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); drop(c, k.id); }} className={cn("group cursor-grab rounded-xl border border-line bg-surface p-3 shadow-sm active:cursor-grabbing", drag === k.id && "opacity-40")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn("text-sm font-medium", k.status === "DONE" && "text-muted line-through")}>{k.title}</div>
                      <div className="flex opacity-0 transition group-hover:opacity-100">
                        <button onClick={() => setEdit(k)} className="p-0.5 text-muted hover:text-ink" aria-label="Modifier"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(k)} className="p-0.5 text-muted hover:text-danger" aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    {k.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{k.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge tone={PRIO_TONE[k.priority as keyof typeof PRIO_TONE]}>{PRIORITIES[k.priority as keyof typeof PRIORITIES]}</Badge>
                      <Badge>{TASK_CATEGORIES[k.category as keyof typeof TASK_CATEGORIES]}</Badge>
                      {k.dueDate && <span className={k.dueDate < t && k.status !== "DONE" ? "text-danger" : "text-muted"}>{shortDate(k.dueDate).slice(0, 5)}{k.time ? ` ${k.time}` : ""}</span>}
                      {k.duration ? <span className="inline-flex items-center gap-0.5 text-muted"><Clock className="h-3 w-3" />{formatMinutes(k.duration)}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setEdit({ status: c })} className="mt-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted hover:bg-surface hover:text-ink">+ Ajouter</button>
            </div>
          ))}
        </div>
      ) : (
        <TaskCalendar tasks={data} onOpen={setEdit} />
      )}
      {edit && <TaskDialog task={edit} onClose={() => { setEdit(null); mutate(); }} />}
    </div>
  );
}

function TaskCalendar({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task | Partial<Task>) => void }) {
  const [month, setMonth] = useState(monthOf(today()));
  const start = startOfWeek(`${month}-01`);
  const end = addDays(startOfWeek(endOfMonth(`${month}-01`)), 6);
  const days = rangeDates(start, end);
  const t = today();
  const noDate = tasks.filter((k) => !k.dueDate && k.status !== "DONE");
  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <Button size="icon-sm" variant="secondary" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mois précédent"><ChevronLeft className="h-4 w-4" /></Button>
        <h3 className="section-title">{monthLabel(month)}</h3>
        <Button size="icon-sm" variant="secondary" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mois suivant"><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line text-xs">
        {["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."].map((d) => <div key={d} className="bg-surface-2 px-2 py-1.5 font-medium text-muted">{d}</div>)}
        {days.map((d) => (
          <div key={d} onDoubleClick={() => onOpen({ dueDate: d })} className={cn("min-h-[92px] bg-surface p-1.5", monthOf(d) !== month && "bg-surface-2/40 text-muted", d === t && "bg-accent-soft/40")}>
            <div className="mb-1 font-medium">{Number(d.slice(8))}</div>
            <div className="space-y-1">
              {tasks.filter((k) => k.dueDate === d).map((k) => (
                <button key={k.id} onClick={() => onOpen(k)} className={cn("block w-full truncate rounded px-1.5 py-0.5 text-left", k.status === "DONE" ? "bg-success-soft text-success line-through" : k.priority === "URGENT" ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary-strong")}>
                  {k.time && `${k.time} `}{k.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Double-cliquez sur un jour pour ajouter une tâche.</p>
      {noDate.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1 text-xs font-medium text-muted">Sans date ({noDate.length})</h4>
          <div className="flex flex-wrap gap-1.5">{noDate.map((k) => <button key={k.id} onClick={() => onOpen(k)} className="chip bg-surface-2 text-ink">{k.title}</button>)}</div>
        </div>
      )}
    </div>
  );
}

function TaskDialog({ task, onClose }: { task: Task | Partial<Task>; onClose: () => void }) {
  const isEdit = "id" in task && !!task.id;
  const [v, setV] = useState({ title: task.title ?? "", description: task.description ?? "", category: task.category ?? "OTHER", priority: task.priority ?? "MEDIUM", status: task.status ?? "TODO", dueDate: task.dueDate ?? "", time: task.time ?? "", duration: task.duration != null ? String(task.duration) : "" });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try {
      const body = { ...v, duration: v.duration === "" ? null : Number(v.duration) };
      await api(isEdit ? `/api/tasks/${task.id}` : "/api/tasks", { method: isEdit ? "PUT" : "POST", body });
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
  };
  return (
    <Dialog open onClose={onClose} title={isEdit ? "Modifier la tâche" : "Nouvelle tâche"} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} disabled={!v.title.trim()}>Enregistrer</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titre" required className="sm:col-span-2"><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <Field label="Catégorie"><Select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} options={TASK_CATEGORIES} /></Field>
        <Field label="Priorité"><Select value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value })} options={PRIORITIES} /></Field>
        <Field label="Statut"><Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })} options={TASK_STATUS} /></Field>
        <Field label="Durée estimée (min)"><Input type="number" min={0} step={5} value={v.duration} onChange={(e) => setV({ ...v, duration: e.target.value })} /></Field>
        <Field label="Date limite"><Input type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} /></Field>
        <Field label="Heure prévue" hint="Avec une heure, la tâche apparaît dans le calendrier."><Input type="time" value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
    </Dialog>
  );
}
