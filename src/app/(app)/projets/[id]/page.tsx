"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, Check, Clock, ExternalLink, Flag, Pencil, Plus, Timer, Trash2, Users } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Progress, Segmented, useUi } from "@/components/ui";
import { ProjectForm, type Project } from "@/components/ProjectForm";
import { ApiError, api, cx, fmtDayNum, refreshAll, useApi } from "@/lib/client";
import { formatDuration, formatTime, today } from "@/lib/dates";
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "WAITING" | "DONE";
  priority: number;
  estimateMin: number;
  spentMin: number;
  dueDate: string | null;
  order: number;
  activities: { id: string; date: string; startTime: string | null; endTime: string | null; status: string; durationMin: number }[];
};
type Event = { id: string; type: "MEETING" | "DELIVERABLE"; title: string; date: string; time: string | null; done: boolean };
type Full = Project & { tasks: Task[]; events: Event[] };

const COLUMNS: Task["status"][] = ["TODO", "IN_PROGRESS", "WAITING", "DONE"];
const COL_STYLE: Record<Task["status"], string> = { TODO: "bg-primary", IN_PROGRESS: "bg-lavender", WAITING: "bg-warning", DONE: "bg-success" };

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast, confirm } = useUi();
  const { data: p, error, mutate } = useApi<Full>(`/api/projects/${id}`);
  const [edit, setEdit] = useState(false);
  const [taskForm, setTaskForm] = useState<Partial<Task> | null>(null);
  const [eventForm, setEventForm] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  if (error) return <ErrorBox error={error} />;
  if (!p) return <Loading />;

  const total = p.tasks.length;
  const done = p.tasks.filter((t) => t.status === "DONE").length;
  const est = p.tasks.reduce((s, t) => s + t.estimateMin, 0);
  const spent = p.tasks.reduce((s, t) => s + t.spentMin, 0);
  const t0 = today();

  async function setStatus(task: Task, status: Task["status"]) {
    if (task.status === status) return;
    await api(`/api/tasks/${task.id}`, { method: "PATCH", body: { status } });
    await mutate();
    refreshAll();
    if (status === "DONE") toast(`« ${task.title} » terminée ✓`);
  }

  async function schedule(task: Task) {
    const remaining = Math.max(30, task.estimateMin - task.spentMin);
    const duration = Math.min(remaining, 120);
    try {
      const r = await api<{ slot: { date: string; startTime: string; endTime: string } }>(`/api/tasks/${task.id}/schedule`, { body: { durationMin: duration } });
      await mutate();
      refreshAll();
      toast(`Créneau réservé le ${fmtDayNum(r.slot.date)} de ${formatTime(r.slot.startTime)} à ${formatTime(r.slot.endTime)}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erreur", "warning");
    }
  }

  async function del() {
    if (!(await confirm({ title: "Supprimer ce projet ?", message: "Les tâches, réunions et livrables seront supprimés. Les créneaux déjà planifiés restent dans ton agenda.", danger: true, confirmLabel: "Supprimer" }))) return;
    await api(`/api/projects/${id}`, { method: "DELETE" });
    await refreshAll();
    router.push("/projets");
  }

  return (
    <div>
      <Link href="/projets" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Projets
      </Link>
      <PageHeader
        title={p.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Users className="h-3.5 w-3.5" /> {p.client}
            <Badge tone={p.status === "ACTIVE" ? "primary" : p.status === "DONE" ? "success" : "warning"}>{PROJECT_STATUS_LABELS[p.status]}</Badge>
            {p.priority >= 3 && <Badge tone={p.priority === 4 ? "danger" : "warning"}>{PRIORITY_LABELS[p.priority]}</Badge>}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" className="text-danger" onClick={del}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="secondary" onClick={() => setEdit(true)}>
              <Pencil className="h-4 w-4" /> Modifier
            </Button>
            <Button onClick={() => setTaskForm({})}>
              <Plus className="h-4 w-4" /> Tâche
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Avancement" value={`${total ? Math.round((done / total) * 100) : 0} %`} extra={<Progress value={total ? (done / total) * 100 : 0} tone="success" className="mt-2" />} />
        <Stat label="Temps passé / estimé" value={`${formatDuration(spent)}`} sub={`sur ${formatDuration(est)}`} extra={<Progress value={est ? (spent / est) * 100 : 0} tone={spent > est ? "warning" : "primary"} className="mt-2" />} />
        <Stat label="Date limite" value={p.deadline ? fmtDayNum(p.deadline) : "—"} sub={p.deadline && p.deadline < t0 && p.status !== "DONE" ? "dépassée" : undefined} />
        <Stat label="Budget" value={p.budget != null ? `${p.budget.toLocaleString("fr-FR")} €` : "—"} />
      </div>

      {p.nextAction && (
        <div className="mb-5 rounded-2xl bg-lavender-soft p-4 text-sm text-ink">
          <span className="font-semibold text-lavender">Prochaine action :</span> {p.nextAction}
        </div>
      )}

      {/* Kanban */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const tasks = p.tasks.filter((t) => t.status === col).sort((a, b) => b.priority - a.priority || a.order - b.order);
          return (
            <div
              key={col}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                setDragOver(null);
                const task = p.tasks.find((t) => t.id === e.dataTransfer.getData("text/plain"));
                if (task) setStatus(task, col);
              }}
              className={cx("rounded-2xl bg-surface-2/60 p-3 transition", dragOver === col && "ring-2 ring-primary/40")}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className={cx("h-2 w-2 rounded-full", COL_STYLE[col])} /> {TASK_STATUS_LABELS[col]}
                </span>
                <span className="text-xs text-muted">{tasks.length}</span>
              </div>
              <div className="space-y-2">
                {tasks.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted">Glisse une tâche ici</p>}
                {tasks.map((t) => {
                  const next = t.activities.filter((a) => a.status !== "DONE" && a.date >= t0).sort((a, b) => (a.date + (a.startTime ?? "")).localeCompare(b.date + (b.startTime ?? "")))[0];
                  return (
                    <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)} className="card cursor-grab p-3 active:cursor-grabbing">
                      <button onClick={() => setTaskForm(t)} className="w-full text-left">
                        <div className={cx("text-sm font-medium text-ink", t.status === "DONE" && "text-muted line-through")}>{t.title}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {t.priority >= 3 && <Badge tone={t.priority === 4 ? "danger" : "warning"}>{PRIORITY_LABELS[t.priority]}</Badge>}
                          {t.dueDate && <Badge tone={t.dueDate <= t0 && t.status !== "DONE" ? "warning" : "neutral"}>{fmtDayNum(t.dueDate)}</Badge>}
                          <Badge>
                            <Timer className="h-3 w-3" /> {formatDuration(t.spentMin)} / {formatDuration(t.estimateMin)}
                          </Badge>
                        </div>
                      </button>
                      {next && (
                        <p className="mt-2 text-[11px] text-primary-strong">
                          📅 {fmtDayNum(next.date)} {next.startTime ? formatTime(next.startTime) : ""}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <select
                          value={t.status}
                          onChange={(e) => setStatus(t, e.target.value as Task["status"])}
                          className="rounded-lg border border-line bg-surface px-1.5 py-1 text-[11px] text-ink-2"
                          aria-label="Statut"
                        >
                          {COLUMNS.map((c) => (
                            <option key={c} value={c}>
                              {TASK_STATUS_LABELS[c]}
                            </option>
                          ))}
                        </select>
                        {t.status !== "DONE" && (
                          <button onClick={() => schedule(t)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-primary-strong hover:bg-primary-soft" title="Réserver un créneau de développement">
                            <CalendarPlus className="h-3.5 w-3.5" /> Réserver
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Réunions et livrables" icon={<Flag className="h-4 w-4" />} action={<Button size="sm" variant="soft" onClick={() => setEventForm(true)}><Plus className="h-3.5 w-3.5" /> Ajouter</Button>}>
          {p.events.length === 0 ? (
            <Empty title="Aucune réunion ni livrable" />
          ) : (
            <ul className="space-y-1.5">
              {p.events.map((e) => (
                <li key={e.id} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2/60">
                  <button
                    onClick={async () => { await api(`/api/project-events/${e.id}`, { method: "PATCH", body: { done: !e.done } }); mutate(); }}
                    className={cx("flex h-5 w-5 items-center justify-center rounded-full border-2", e.done ? "border-success bg-success text-white" : "border-line")}
                    aria-label="Marquer comme fait"
                  >
                    {e.done && <Check className="h-3 w-3" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={cx("truncate text-sm text-ink", e.done && "line-through text-muted")}>{e.title}</div>
                    <div className="text-xs text-muted">
                      {e.type === "MEETING" ? "Réunion" : "Livrable"} · {fmtDayNum(e.date)} {e.time ? formatTime(e.time) : ""}
                    </div>
                  </div>
                  <button onClick={async () => { await api(`/api/project-events/${e.id}`, { method: "DELETE" }); mutate(); }} className="hidden text-muted hover:text-danger group-hover:block" aria-label="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Description, notes et liens" icon={<Clock className="h-4 w-4" />}>
          <div className="space-y-3 text-sm">
            {p.description ? <p className="whitespace-pre-wrap text-ink-2">{p.description}</p> : <p className="text-muted">Pas de description.</p>}
            {p.notes && <p className="whitespace-pre-wrap rounded-xl bg-surface-2/60 p-3 text-ink-2">{p.notes}</p>}
            {p.links.length > 0 && (
              <ul className="space-y-1">
                {p.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-strong underline">
                      {l.label || l.url} <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {edit && <ProjectForm open initial={p} onClose={() => setEdit(false)} />}
      {taskForm && <TaskForm projectId={id} initial={taskForm} onClose={() => setTaskForm(null)} onSaved={() => mutate()} onSchedule={(t) => schedule(t)} />}
      {eventForm && <EventForm projectId={id} onClose={() => setEventForm(false)} onSaved={() => mutate()} />}
    </div>
  );
}

function Stat({ label, value, sub, extra }: { label: string; value: string; sub?: string; extra?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold text-ink">
        {value} {sub && <span className="text-xs font-normal text-muted">{sub}</span>}
      </div>
      {extra}
    </div>
  );
}

function TaskForm({ projectId, initial, onClose, onSaved, onSchedule }: { projectId: string; initial: Partial<Task>; onClose: () => void; onSaved: () => void; onSchedule: (t: Task) => void }) {
  const { toast, confirm } = useUi();
  const [f, setF] = useState({
    title: initial.title ?? "",
    description: initial.description ?? "",
    status: initial.status ?? "TODO",
    priority: initial.priority ?? 2,
    estimateMin: initial.estimateMin ?? 60,
    spentMin: initial.spentMin ?? 0,
    dueDate: initial.dueDate ?? "",
  });
  const [log, setLog] = useState(30);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!f.title.trim()) return toast("Titre requis", "danger");
    setSaving(true);
    try {
      const body = { ...f, dueDate: f.dueDate || null };
      if (initial.id) await api(`/api/tasks/${initial.id}`, { method: "PATCH", body });
      else await api(`/api/projects/${projectId}/tasks`, { body });
      onSaved();
      refreshAll();
      toast(initial.id ? "Tâche modifiée" : "Tâche ajoutée");
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
      title={initial.id ? "Tâche" : "Nouvelle tâche"}
      footer={
        <>
          {initial.id && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={async () => {
                if (!(await confirm({ title: "Supprimer cette tâche ?", danger: true, confirmLabel: "Supprimer" }))) return;
                await api(`/api/tasks/${initial.id}`, { method: "DELETE" });
                onSaved();
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {initial.id && f.status !== "DONE" && (
            <Button variant="secondary" onClick={() => { onSchedule(initial as Task); onClose(); }}>
              <CalendarPlus className="h-4 w-4" /> Réserver un créneau
            </Button>
          )}
          <Button onClick={save} loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Titre">
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea className="input min-h-[60px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div>
          <span className="label">Statut</span>
          <Segmented value={f.status} onChange={(v) => setF({ ...f, status: v })} options={COLUMNS.map((c) => ({ value: c, label: TASK_STATUS_LABELS[c] }))} />
        </div>
        <div>
          <span className="label">Priorité</span>
          <Segmented value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={[1, 2, 3, 4].map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Estimé (min)">
            <input type="number" min={0} step={15} className="input" value={f.estimateMin} onChange={(e) => setF({ ...f, estimateMin: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Passé (min)">
            <input type="number" min={0} step={15} className="input" value={f.spentMin} onChange={(e) => setF({ ...f, spentMin: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Échéance">
            <input type="date" className="input" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          </Field>
        </div>
        {initial.id && (
          <div className="flex items-end gap-2 rounded-xl bg-surface-2/60 p-3">
            <Field label="Ajouter du temps passé (min)" className="flex-1">
              <input type="number" min={5} step={5} className="input h-9" value={log} onChange={(e) => setLog(Number(e.target.value) || 0)} />
            </Field>
            <Button size="sm" variant="secondary" onClick={() => setF({ ...f, spentMin: f.spentMin + log })}>
              <Timer className="h-4 w-4" /> + {log} min
            </Button>
          </div>
        )}
        <p className="text-xs text-muted">Les créneaux réservés pour cette tâche ajoutent automatiquement leur durée au temps passé lorsqu&apos;ils sont marqués comme terminés.</p>
      </div>
    </Modal>
  );
}

function EventForm({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ type: "MEETING" as "MEETING" | "DELIVERABLE", title: "", date: today(), time: "10:00" });
  async function save() {
    if (!f.title.trim()) return toast("Titre requis", "danger");
    try {
      await api(`/api/projects/${projectId}/events`, { body: { ...f, time: f.time || null } });
      onSaved();
      refreshAll();
      toast(f.type === "MEETING" && f.time ? "Réunion ajoutée (et placée dans le planning)" : "Ajouté");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }
  return (
    <Modal open onClose={onClose} title="Réunion ou livrable" size="sm" footer={<Button onClick={save}>Ajouter</Button>}>
      <div className="space-y-3">
        <Segmented value={f.type} onChange={(v) => setF({ ...f, type: v })} options={[{ value: "MEETING", label: "Réunion" }, { value: "DELIVERABLE", label: "Livrable" }]} />
        <Field label="Titre">
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Heure (facultatif)">
            <input type="time" className="input" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
