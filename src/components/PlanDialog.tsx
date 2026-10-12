"use client";

import { useEffect, useState } from "react";
import { Coffee, Feather, Moon, Sparkles, Utensils, Wand2, X } from "lucide-react";
import { Button, Modal, Notice, Segmented, Spinner, Toggle, useUi } from "@/components/ui";
import { api, cx, fmtDateLong, refreshAll } from "@/lib/client";
import { addMinutesToTime, formatDuration, formatTime, timeToMin } from "@/lib/dates";
import type { PlanBlock, PlanResult } from "@/lib/planner";
import { ENERGY_EMOJI, ENERGY_LABELS } from "@/lib/constants";
import { findConflicts } from "@/lib/conflicts";

const KIND_STYLE: Record<PlanBlock["kind"], string> = {
  fixed: "border-l-navy bg-primary-soft/60",
  task: "border-l-primary bg-surface",
  suggestion: "border-l-lavender bg-lavender-soft/60",
  break: "border-l-line bg-surface-2/50",
  rest: "border-l-success bg-success-soft/60",
  meal: "border-l-warning bg-warning-soft/50",
};

export function PlanDialog({ open, onClose, date, defaultEnergy, light: lightInit = false }: { open: boolean; onClose: () => void; date: string; defaultEnergy?: number; light?: boolean }) {
  const { toast } = useUi();
  const [energy, setEnergy] = useState(defaultEnergy ?? 3);
  const [light, setLight] = useState(lightInit);
  const [reshuffle, setReshuffle] = useState(true);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [blocks, setBlocks] = useState<PlanBlock[]>([]);
  const [postponed, setPostponed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  async function generate(e = energy, l = light, r = reshuffle) {
    setLoading(true);
    try {
      const p = await api<PlanResult>("/api/planner", { body: { date, energy: e, light: l, reshuffle: r } });
      setPlan(p);
      setBlocks(p.blocks);
      setPostponed(Object.fromEntries(p.postponed.map((x) => [`${x.id}|${x.occurrenceDate}`, true])));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "danger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setEnergy(defaultEnergy ?? 3);
      setLight(lightInit);
      generate(defaultEnergy ?? 3, lightInit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  const editable = (b: PlanBlock) => b.kind === "task" || b.kind === "suggestion";
  const conflicts = findConflicts(blocks.filter((b) => b.kind !== "break").map((b) => ({ id: b.key, title: b.title, startTime: b.startTime, endTime: b.endTime })));

  function updateStart(key: string, start: string) {
    setBlocks((bs) =>
      bs
        .map((b) => (b.key === key ? { ...b, startTime: start, endTime: addMinutesToTime(start, timeToMin(b.endTime) - timeToMin(b.startTime)) } : b))
        .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime)),
    );
  }

  async function apply() {
    if (!plan) return;
    setApplying(true);
    try {
      const toPostpone = plan.postponed.filter((p) => postponed[`${p.id}|${p.occurrenceDate}`]).map((p) => ({ id: p.id, occurrenceDate: p.occurrenceDate }));
      const r = await api<{ updated: number; created: number; postponed: number }>("/api/planner/apply", {
        body: {
          date,
          blocks: blocks.filter((b) => b.kind === "task" || b.kind === "suggestion"),
          postponed: toPostpone,
          // tâches retirées à la main ou non placées : elles redeviennent « sans horaire »
          unplaced: [...plan.notPlaced.map((n) => n.id), ...plan.blocks.filter((b) => b.kind === "task" && b.refId && !blocks.some((x) => x.key === b.key)).map((b) => b.refId!)],
        },
      });
      await refreshAll();
      toast(`Planning appliqué : ${r.updated + r.created} créneau(x), ${r.postponed} report(s). Tu peux tout modifier ensuite.`);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "danger");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-lavender" /> {light ? "Journée légère" : "Organiser ma journée"}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={apply} loading={applying} disabled={!plan || loading || conflicts.length > 0}>
            Appliquer ce planning
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">{fmtDateLong(date)} — proposition modifiable, rien n&apos;est enregistré avant validation.</p>
        <div>
          <span className="label">Comment te sens-tu ?</span>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setEnergy(n);
                  generate(n, light);
                }}
                className={cx(
                  "flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-[11px] transition",
                  energy === n ? "border-primary bg-primary-soft text-primary-strong" : "border-line text-ink-2 hover:bg-surface-2",
                )}
                title={ENERGY_LABELS[n]}
              >
                <span className="text-lg" aria-hidden>
                  {ENERGY_EMOJI[n]}
                </span>
                <span className="hidden leading-tight sm:block">{ENERGY_LABELS[n].replace("Énergie ", "").replace(" énergie", "")}</span>
              </button>
            ))}
          </div>
        </div>
        <Segmented
          value={light ? "light" : "normal"}
          onChange={(v) => {
            setLight(v === "light");
            generate(energy, v === "light");
          }}
          options={[
            { value: "normal", label: "Planning adapté" },
            { value: "light", label: <span className="inline-flex items-center gap-1"><Feather className="h-3 w-3" /> Journée légère</span> },
          ]}
        />

        <Toggle
          checked={reshuffle}
          onChange={(v) => {
            setReshuffle(v);
            generate(energy, light, v);
          }}
          label="Réorganiser aussi les tâches déjà placées"
          description="Les rendez-vous fixes, séances de cours, activités récurrentes et le passé ne bougent jamais"
        />

        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted">
            <Spinner /> Je prépare une proposition réaliste…
          </div>
        )}

        {plan && !loading && (
          <>
            <div className="space-y-2">
              {plan.messages.map((m, i) => (
                <Notice key={i} tone={i === 0 ? "info" : "warning"}>
                  {m}
                </Notice>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                Travail concentré : <strong className="text-ink">{formatDuration(plan.focusMinutes)}</strong> / capacité {formatDuration(plan.capacityMinutes)}
              </span>
            </div>
            {conflicts.length > 0 && <Notice tone="danger">Deux blocs se chevauchent ({conflicts[0][0].title} / {conflicts[0][1].title}). Ajuste une heure avant d&apos;appliquer.</Notice>}
            <ol className="space-y-1.5">
              {blocks.length === 0 && <li className="text-sm text-muted">Rien à placer : profite de ta journée !</li>}
              {blocks.map((b) => (
                <li key={b.key} className={cx("flex items-center gap-3 rounded-xl border border-line/60 border-l-4 px-3 py-2", KIND_STYLE[b.kind])}>
                  <div className="w-20 shrink-0 text-xs tabular-nums text-ink-2">
                    {editable(b) ? (
                      <input
                        type="time"
                        value={b.startTime}
                        onChange={(e) => e.target.value && updateStart(b.key, e.target.value)}
                        className="w-[5.2rem] rounded-md border border-line bg-surface px-1 py-0.5 text-xs"
                        aria-label={`Heure de début de ${b.title}`}
                      />
                    ) : (
                      formatTime(b.startTime)
                    )}
                    <div className="text-[10px] text-muted">→ {formatTime(b.endTime)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm text-ink">
                      {b.kind === "meal" && <Utensils className="h-3.5 w-3.5 text-warning" />}
                      {b.kind === "rest" && <Moon className="h-3.5 w-3.5 text-success" />}
                      {b.kind === "break" && <Coffee className="h-3.5 w-3.5 text-muted" />}
                      {b.kind === "suggestion" && <Sparkles className="h-3.5 w-3.5 text-lavender" />}
                      <span className="truncate">{b.title}</span>
                      {b.part && <span className="text-xs text-muted">({b.part.index}/{b.part.total})</span>}
                    </div>
                    <div className="text-[11px] text-muted">
                      {b.kind === "fixed" && "Fixe — non déplacé"}
                      {b.kind === "task" && "Tâche placée"}
                      {b.kind === "suggestion" && "Suggestion facultative"}
                      {b.kind === "rest" && "Temps de repos"}
                      {b.kind === "break" && "Pause"}
                      {b.kind === "meal" && "Pause repas"}
                    </div>
                  </div>
                  {editable(b) && (
                    <button onClick={() => setBlocks((bs) => bs.filter((x) => x.key !== b.key))} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Retirer ce bloc">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ol>
            {plan.postponed.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold text-ink-2">Proposé au report (décoche pour garder dans ta liste)</h3>
                <ul className="space-y-1">
                  {plan.postponed.map((p) => {
                    const k = `${p.id}|${p.occurrenceDate}`;
                    return (
                      <li key={k}>
                        <label className="flex items-center gap-2 text-sm text-ink-2">
                          <input type="checkbox" checked={!!postponed[k]} onChange={(e) => setPostponed((s) => ({ ...s, [k]: e.target.checked }))} className="h-4 w-4 accent-[rgb(var(--primary))]" />
                          <span className="flex-1">{p.title}</span>
                          <span className="text-[11px] text-muted">{p.reason}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {plan.notPlaced.length > 0 && (
              <div className="text-xs text-muted">
                Restent dans ta liste sans horaire : {plan.notPlaced.map((n) => n.title).join(", ")}.
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
