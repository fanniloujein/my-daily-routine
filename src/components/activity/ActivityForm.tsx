"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, CalendarClock, Plus, X } from "lucide-react";
import { Button, Field, Modal, Notice, Segmented, Toggle, WeekdayPicker, useUi } from "@/components/ui";
import { ApiError, api, refreshAll } from "@/lib/client";
import { useCategories, type Occurrence } from "@/lib/hooks";
import { addMinutesToTime, formatTime, timeToMin, today } from "@/lib/dates";
import { describeRecurrence } from "@/lib/recurrence";
import { ENERGY_COST_LABELS, PRIORITY_LABELS } from "@/lib/constants";

export type ActivityDraft = {
  id?: string;
  title: string;
  categoryId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  priority: number;
  status: string;
  description: string;
  notes: string;
  isFixed: boolean;
  energyCost: number;
  dueDate: string;
  reminders: number[];
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "CUSTOM";
  interval: number;
  weekdays: number[];
  until: string;
};

export function emptyDraft(partial: Partial<ActivityDraft> = {}): ActivityDraft {
  return {
    title: "",
    categoryId: "",
    date: today(),
    startTime: "",
    endTime: "",
    durationMin: 30,
    priority: 2,
    status: "TODO",
    description: "",
    notes: "",
    isFixed: false,
    energyCost: 2,
    dueDate: "",
    reminders: [],
    recurrence: "NONE",
    interval: 1,
    weekdays: [],
    until: "",
    ...partial,
  };
}

export function draftFromOccurrence(o: Occurrence): ActivityDraft {
  return emptyDraft({
    id: o.id,
    title: o.title,
    categoryId: o.categoryId,
    date: o.isRecurring ? o.originalDate : o.date,
    startTime: o.startTime ?? "",
    endTime: o.endTime ?? "",
    durationMin: o.durationMin,
    priority: o.priority,
    status: o.status,
    description: o.description ?? "",
    notes: o.notes ?? "",
    isFixed: o.isFixed,
    energyCost: o.energyCost,
    dueDate: o.dueDate ?? "",
    reminders: o.reminders,
    recurrence: o.recurrence as ActivityDraft["recurrence"],
    interval: o.interval,
    weekdays: o.weekdays,
    until: o.until ?? "",
  });
}

const REMINDER_PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440];
const reminderLabel = (m: number) => (m === 0 ? "À l'heure" : m < 60 ? `${m} min avant` : m === 1440 ? "La veille" : `${m / 60} h avant`);

type Conflict = { conflicts: { id: string; title: string; date: string; startTime: string; endTime: string; isFixed: boolean }[]; suggestion: { date: string; startTime: string; endTime: string } | null };

export function ActivityForm({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial: ActivityDraft; onSaved?: (a: { id: string; date: string }) => void }) {
  const { data: categories } = useCategories();
  const { toast } = useUi();
  const [d, setD] = useState<ActivityDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [more, setMore] = useState(false);
  const [timed, setTimed] = useState(!!initial.startTime);

  useEffect(() => {
    if (open) {
      setD(initial);
      setErrors({});
      setConflict(null);
      setTimed(!!initial.startTime);
      setMore(!!(initial.id && (initial.description || initial.notes || initial.recurrence !== "NONE")));
    }
  }, [open, initial]);

  useEffect(() => {
    if (!d.categoryId && categories?.length) {
      const cat = categories.find((c) => c.kind === "personal") ?? categories[0];
      setD((x) => ({ ...x, categoryId: cat.id, reminders: x.reminders.length || x.id ? x.reminders : cat.reminderMinutes != null ? [cat.reminderMinutes] : [] }));
    }
  }, [categories, d.categoryId]);

  const set = <K extends keyof ActivityDraft>(k: K, v: ActivityDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  const onStart = (v: string) => {
    setD((x) => ({ ...x, startTime: v, endTime: v ? addMinutesToTime(v, x.durationMin) : "" }));
  };
  const onEnd = (v: string) => {
    setD((x) => ({ ...x, endTime: v, durationMin: x.startTime && v && timeToMin(v) > timeToMin(x.startTime) ? timeToMin(v) - timeToMin(x.startTime) : x.durationMin }));
  };
  const onDuration = (v: number) => {
    setD((x) => ({ ...x, durationMin: v, endTime: x.startTime ? addMinutesToTime(x.startTime, v) : x.endTime }));
  };

  const recurrenceText = useMemo(
    () => (d.recurrence === "NONE" ? null : describeRecurrence({ date: d.date, recurrence: d.recurrence, interval: d.interval, weekdays: d.weekdays, until: d.until })),
    [d],
  );

  async function save(allowConflict = false, override?: Partial<ActivityDraft>) {
    const payload = { ...d, ...override };
    if (!timed) {
      payload.startTime = "";
      payload.endTime = "";
    }
    const e: Record<string, string> = {};
    if (!payload.title.trim()) e.title = "Donne un titre à l'activité";
    if (!payload.categoryId) e.categoryId = "Choisis une catégorie";
    if (timed && !payload.startTime) e.startTime = "Indique une heure ou décoche « horaire fixe »";
    if (payload.startTime && payload.endTime && timeToMin(payload.endTime) <= timeToMin(payload.startTime)) e.endTime = "L'heure de fin doit être après le début";
    if (payload.recurrence === "CUSTOM" && payload.weekdays.length === 0) e.weekdays = "Choisis au moins un jour";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const body = { ...payload, allowConflict, dueDate: payload.dueDate || null, until: payload.until || null };
      const res = payload.id
        ? await api<{ id: string; date: string }>(`/api/activities/${payload.id}`, { method: "PATCH", body })
        : await api<{ id: string; date: string }>("/api/activities", { body });
      toast(payload.id ? "Activité modifiée" : "Activité ajoutée ✨");
      await refreshAll();
      onSaved?.(res);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConflict(err.data as unknown as Conflict);
      else if (err instanceof ApiError) {
        const issue = (err.data.issues as { path: string[]; message: string }[] | undefined)?.[0];
        if (issue) setErrors({ [issue.path[0]]: issue.message });
        toast(err.message, "danger");
      } else toast("Enregistrement impossible. Vérifie ta connexion.", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={d.id ? "Modifier l'activité" : "Nouvelle activité"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => save(false)} loading={saving}>
            {d.id ? "Enregistrer" : "Ajouter"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        {d.id && d.recurrence !== "NONE" && <Notice tone="info">Activité récurrente : les modifications s&apos;appliquent à toute la série.</Notice>}

        <Field label="Titre" error={errors.title}>
          <input className="input text-base" value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex. Préparer la fiche de Lina" maxLength={200} />
        </Field>

        <div>
          <span className="label">Catégorie</span>
          <div className="flex flex-wrap gap-1.5">
            {categories?.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setD((x) => ({ ...x, categoryId: c.id, reminders: x.id || !x.startTime ? x.reminders : c.reminderMinutes != null ? [c.reminderMinutes] : x.reminders }))}
                className="rounded-full border px-2.5 py-1 text-xs font-medium transition"
                style={
                  d.categoryId === c.id
                    ? { backgroundColor: c.color, borderColor: c.color, color: "#fff" }
                    : { borderColor: `${c.color}55`, color: "rgb(var(--ink-2))", backgroundColor: `${c.color}12` }
                }
              >
                {c.name}
              </button>
            ))}
          </div>
          {errors.categoryId && <span className="mt-1 block text-[11px] text-danger">{errors.categoryId}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Date" className="col-span-2 sm:col-span-1">
            <input type="date" className="input" value={d.date} onChange={(e) => set("date", e.target.value)} required />
          </Field>
          <Field label="Durée estimée (min)" className="col-span-2 sm:col-span-1">
            <input type="number" min={5} step={5} className="input" value={d.durationMin} onChange={(e) => onDuration(Math.max(5, Number(e.target.value) || 5))} />
          </Field>
          {timed ? (
            <>
              <Field label="Début" error={errors.startTime}>
                <input type="time" className="input" value={d.startTime} onChange={(e) => onStart(e.target.value)} />
              </Field>
              <Field label="Fin" error={errors.endTime}>
                <input type="time" className="input" value={d.endTime} onChange={(e) => onEnd(e.target.value)} />
              </Field>
            </>
          ) : (
            <div className="col-span-2 flex items-end">
              <p className="pb-2 text-xs text-muted">Sans horaire : l&apos;activité pourra être placée par « Organiser ma journée ».</p>
            </div>
          )}
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          <Toggle checked={timed} onChange={(v) => { setTimed(v); if (!v) setD((x) => ({ ...x, startTime: "", endTime: "" })); }} label="Horaire précis" description="Sinon : activité flexible sans heure fixe" />
          <Toggle checked={d.isFixed} onChange={(v) => set("isFixed", v)} label="Rendez-vous fixe" description="Ne sera jamais déplacé automatiquement" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="label">Priorité</span>
            <Segmented value={d.priority} onChange={(v) => set("priority", v)} options={[1, 2, 3, 4].map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
          </div>
          <div>
            <span className="label">Énergie demandée</span>
            <Segmented value={d.energyCost} onChange={(v) => set("energyCost", v)} options={[1, 2, 3].map((p) => ({ value: p, label: ENERGY_COST_LABELS[p] }))} />
          </div>
        </div>

        <div>
          <span className="label flex items-center gap-1">
            <Bell className="h-3.5 w-3.5" /> Rappels {!timed && <span className="font-normal text-muted">(nécessitent un horaire)</span>}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_PRESETS.map((m) => {
              const on = d.reminders.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  disabled={!timed}
                  onClick={() => set("reminders", on ? d.reminders.filter((x) => x !== m) : [...d.reminders, m].sort((a, b) => a - b).slice(0, 5))}
                  className={`rounded-full px-2.5 py-1 text-xs transition disabled:opacity-40 ${on ? "bg-warning-soft font-medium text-warning ring-1 ring-warning/40" : "bg-surface-2 text-ink-2"}`}
                >
                  {reminderLabel(m)}
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={() => setMore(!more)} className="flex items-center gap-1 text-xs font-medium text-primary-strong">
          {more ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {more ? "Moins d'options" : "Récurrence, échéance, description et notes"}
        </button>

        {more && (
          <div className="space-y-4 rounded-2xl bg-surface-2/60 p-3 sm:p-4">
            <div>
              <span className="label">Fréquence</span>
              <Segmented
                value={d.recurrence}
                onChange={(v) => setD((x) => ({ ...x, recurrence: v, weekdays: v === "CUSTOM" && !x.weekdays.length ? [new Date(x.date + "T12:00").getDay()] : x.weekdays }))}
                options={[
                  { value: "NONE", label: "Unique" },
                  { value: "DAILY", label: "Quotidienne" },
                  { value: "WEEKLY", label: "Hebdomadaire" },
                  { value: "CUSTOM", label: "Personnalisée" },
                ]}
              />
            </div>
            {d.recurrence !== "NONE" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={d.recurrence === "DAILY" ? "Tous les … jours" : "Toutes les … semaines"}>
                  <input type="number" min={1} max={52} className="input" value={d.interval} onChange={(e) => set("interval", Math.max(1, Number(e.target.value) || 1))} />
                </Field>
                <Field label="Jusqu'au (facultatif)">
                  <input type="date" className="input" value={d.until} min={d.date} onChange={(e) => set("until", e.target.value)} />
                </Field>
                {(d.recurrence === "WEEKLY" || d.recurrence === "CUSTOM") && (
                  <div className="sm:col-span-2">
                    <span className="label">Jours</span>
                    <WeekdayPicker value={d.weekdays} onChange={(v) => set("weekdays", v)} />
                    {errors.weekdays && <span className="mt-1 block text-[11px] text-danger">{errors.weekdays}</span>}
                  </div>
                )}
                {recurrenceText && <p className="text-xs text-muted sm:col-span-2">↻ {recurrenceText}</p>}
              </div>
            )}
            <Field label="Échéance (facultatif)" hint="Utilisée pour prioriser la tâche">
              <input type="date" className="input" value={d.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </Field>
            <Field label="Description">
              <textarea className="input min-h-[70px]" value={d.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Notes personnelles">
              <textarea className="input min-h-[70px]" value={d.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        )}

        {conflict && (
          <div className="space-y-3 rounded-2xl border border-warning/40 bg-warning-soft p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-warning">
              <AlertTriangle className="h-4 w-4" /> Conflit d&apos;horaire
            </p>
            <ul className="space-y-1 text-ink-2">
              {conflict.conflicts.map((c) => (
                <li key={c.id + c.date}>
                  • {c.title} — {formatTime(c.startTime)} à {formatTime(c.endTime)}
                  {c.isFixed ? " (rendez-vous fixe)" : ""}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {conflict.suggestion && (
                <Button
                  size="sm"
                  type="button"
                  onClick={() => {
                    const s = conflict.suggestion!;
                    setD((x) => ({ ...x, date: s.date, startTime: s.startTime, endTime: s.endTime }));
                    setConflict(null);
                    save(false, { date: s.date, startTime: s.startTime, endTime: s.endTime });
                  }}
                >
                  <CalendarClock className="h-4 w-4" /> Utiliser le créneau libre : {s(conflict.suggestion)}
                </Button>
              )}
              <Button size="sm" variant="secondary" type="button" onClick={() => save(true)}>
                Enregistrer quand même
              </Button>
            </div>
          </div>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function s(x: { date: string; startTime: string }) {
  const [, m, d] = x.date.split("-");
  return `${d}/${m} à ${formatTime(x.startTime)}`;
}
