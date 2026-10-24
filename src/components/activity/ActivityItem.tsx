"use client";

import { useState } from "react";
import { Bell, CalendarArrowUp, Check, Copy, MoreHorizontal, Pencil, Pin, Play, Repeat, SkipForward, Trash2 } from "lucide-react";
import { Button, Field, Modal, Segmented, useUi } from "@/components/ui";
import { CategoryIcon } from "@/components/Icon";
import { NameTag } from "@/components/NameTag";
import { ApiError, api, cx, fmtDayNum, refreshAll } from "@/lib/client";
import { addDays, formatDuration, formatTime } from "@/lib/dates";
import type { Occurrence } from "@/lib/hooks";
import { useActivityEditor } from "./ActivityEditorContext";
import { draftFromOccurrence } from "./ActivityForm";

export async function setOccurrenceStatus(o: Occurrence, status: Occurrence["status"]) {
  await api(`/api/activities/${o.id}/occurrence`, { body: { action: "status", date: o.originalDate, status } });
  await refreshAll();
}

export function ActivityItem({ o, compact, showDate, onSelect }: { o: Occurrence; compact?: boolean; showDate?: boolean; onSelect?: (o: Occurrence) => void }) {
  const { toast } = useUi();
  const editor = useActivityEditor();
  const [menu, setMenu] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const done = o.status === "DONE";

  async function toggleDone() {
    const prev = o.status;
    try {
      await setOccurrenceStatus(o, done ? "TODO" : "DONE");
      if (!done) toast(`Bravo, « ${o.title} » est terminée 🌿`, "success", { label: "Annuler", onClick: () => setOccurrenceStatus(o, prev) });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }

  async function postpone() {
    try {
      await api(`/api/activities/${o.id}/occurrence`, { body: { action: "postpone", date: o.originalDate } });
      await refreshAll();
      toast(o.isRecurring ? "Occurrence reportée — la prochaine reste prévue" : "Reportée à demain, sans pression");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }

  async function duplicate() {
    try {
      await api(`/api/activities/${o.id}/duplicate`, { body: { date: o.date } });
      await refreshAll();
      toast("Activité dupliquée");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }

  async function setInProgress() {
    await setOccurrenceStatus(o, "IN_PROGRESS");
    toast("C'est parti !", "info");
  }

  return (
    <div
      className={cx(
        "group relative flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition hover:border-line hover:bg-surface-2/50",
        done && "opacity-60",
        o.status === "POSTPONED" && "opacity-50",
      )}
    >
      <button
        onClick={toggleDone}
        className={cx(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition",
          done ? "border-success bg-success text-white" : "border-line hover:border-success hover:bg-success-soft",
        )}
        aria-label={done ? "Marquer comme non terminée" : "Marquer comme terminée"}
        title={done ? "Marquer comme non terminée" : "Terminer"}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: o.color }} aria-hidden />
      <button className="min-w-0 flex-1 text-left" onClick={() => (onSelect ? onSelect(o) : editor.open(draftFromOccurrence(o)))}>
        <div className={cx("flex items-center gap-1.5 text-sm font-medium text-ink", done && "line-through decoration-ink/30")}>
          <span className="truncate">{o.title}</span>
          {o.isFixed && <Pin className="h-3 w-3 shrink-0 text-muted" aria-label="Rendez-vous fixe" />}
          {o.isRecurring && <Repeat className="h-3 w-3 shrink-0 text-muted" aria-label="Récurrente" />}
          {o.reminders.length > 0 && o.startTime && <Bell className="h-3 w-3 shrink-0 text-warning" aria-label="Rappel" />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
          {o.studentName && <NameTag name={o.studentName} color={o.color} size="sm" />}
          {showDate && <span>{fmtDayNum(o.date)}</span>}
          {o.startTime ? (
            <span className="font-medium text-ink-2">
              {formatTime(o.startTime)} – {formatTime(o.endTime)}
            </span>
          ) : (
            <span>Sans horaire · {formatDuration(o.durationMin)}</span>
          )}
          {!compact && (
            <span className="inline-flex items-center gap-1">
              <CategoryIcon name={o.category.icon} className="h-3 w-3" /> {o.category.name}
            </span>
          )}
          {o.priority >= 4 && <span className="font-semibold text-danger">Urgent</span>}
          {o.priority === 3 && <span className="text-warning">Priorité haute</span>}
          {o.status === "IN_PROGRESS" && <span className="text-primary-strong">En cours</span>}
          {o.status === "POSTPONED" && <span>Reportée</span>}
          {o.dueDate && !done && <span>Échéance {fmtDayNum(o.dueDate)}</span>}
        </div>
      </button>
      {!done && (
        <button onClick={postpone} className="hidden rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink sm:group-hover:block" title="Reporter à demain" aria-label="Reporter à demain">
          <SkipForward className="h-4 w-4" />
        </button>
      )}
      <div className="relative">
        <button onClick={() => setMenu(!menu)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink" aria-label="Actions" aria-expanded={menu}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-8 z-40 w-48 overflow-hidden rounded-xl border border-line bg-surface py-1 text-sm shadow-pop animate-scale-in">
              {[
                { icon: Pencil, label: "Modifier", fn: () => editor.open(draftFromOccurrence(o)) },
                !done && o.status !== "IN_PROGRESS" && { icon: Play, label: "Commencer", fn: setInProgress },
                !done && { icon: SkipForward, label: "Reporter à demain", fn: postpone },
                { icon: CalendarArrowUp, label: "Déplacer…", fn: () => setMoveOpen(true) },
                { icon: Copy, label: "Dupliquer", fn: duplicate },
                { icon: Trash2, label: "Supprimer…", fn: () => setDeleteOpen(true), danger: true },
              ]
                .filter(Boolean)
                .map((item) => {
                  const it = item as { icon: typeof Pencil; label: string; fn: () => void; danger?: boolean };
                  return (
                    <button
                      key={it.label}
                      className={cx("flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2", it.danger ? "text-danger" : "text-ink")}
                      onClick={() => {
                        setMenu(false);
                        it.fn();
                      }}
                    >
                      <it.icon className="h-4 w-4" /> {it.label}
                    </button>
                  );
                })}
            </div>
          </>
        )}
      </div>
      <MoveDialog o={o} open={moveOpen} onClose={() => setMoveOpen(false)} />
      <DeleteDialog o={o} open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}

export function MoveDialog({ o, open, onClose }: { o: Occurrence; open: boolean; onClose: () => void }) {
  const { toast } = useUi();
  const [date, setDate] = useState(addDays(o.date, 1));
  const [time, setTime] = useState(o.startTime ?? "");
  const [conflict, setConflict] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function move(allowConflict = false) {
    setLoading(true);
    try {
      await api(`/api/activities/${o.id}/occurrence`, { body: { action: "move", date: o.originalDate, newDate: date, startTime: time || null, allowConflict } });
      await refreshAll();
      toast(`Déplacée au ${fmtDayNum(date)}`);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const c = e.data as { conflicts: { title: string }[]; suggestion: { date: string; startTime: string } | null };
        setConflict(`Conflit avec ${c.conflicts.map((x) => x.title).join(", ")}.${c.suggestion ? ` Créneau libre : ${fmtDayNum(c.suggestion.date)} à ${formatTime(c.suggestion.startTime)}.` : ""}`);
        if (c.suggestion) {
          setDate(c.suggestion.date);
          setTime(c.suggestion.startTime);
        }
      } else toast(e instanceof Error ? e.message : "Erreur", "danger");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Déplacer l'activité"
      size="sm"
      footer={
        <>
          {conflict && (
            <Button variant="secondary" onClick={() => move(true)}>
              Forcer
            </Button>
          )}
          <Button onClick={() => move(false)} loading={loading}>
            Déplacer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-2">{o.title}</p>
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2, 7].map((n) => (
            <button key={n} type="button" className="rounded-full bg-surface-2 px-2.5 py-1 text-xs" onClick={() => setDate(addDays(o.date, n || 0))}>
              {n === 0 ? "Même jour" : n === 1 ? "+1 jour" : n === 2 ? "+2 jours" : "+1 semaine"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nouvelle date">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Heure (facultatif)">
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        {conflict && <p className="rounded-xl bg-warning-soft p-2 text-xs text-warning">{conflict}</p>}
      </div>
    </Modal>
  );
}

export function DeleteDialog({ o, open, onClose }: { o: Occurrence; open: boolean; onClose: () => void }) {
  const { toast } = useUi();
  const [scope, setScope] = useState<"occurrence" | "following" | "series">(o.isRecurring ? "occurrence" : "series");
  const [loading, setLoading] = useState(false);
  async function del() {
    setLoading(true);
    try {
      await api(`/api/activities/${o.id}?scope=${scope}&date=${o.originalDate}`, { method: "DELETE" });
      await refreshAll();
      toast("Activité supprimée");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Supprimer l'activité ?"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="danger" onClick={del} loading={loading}>
            Supprimer
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink-2">
        <p>
          « {o.title} » {o.isFixed && <strong className="text-warning">(rendez-vous fixe)</strong>}
        </p>
        {o.lessonId && <p className="text-xs text-muted">Astuce : pour annuler une séance de cours, utilise plutôt l&apos;espace Cours particuliers.</p>}
        {o.isRecurring && (
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: "occurrence", label: "Cette occurrence" },
              { value: "following", label: "Celle-ci et les suivantes" },
              { value: "series", label: "Toute la série" },
            ]}
          />
        )}
        <p className="text-xs text-muted">Cette action est définitive.</p>
      </div>
    </Modal>
  );
}
