"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bot, Check, Cpu, Send, Sparkles, X } from "lucide-react";
import { Badge, Button, PageHeader, Spinner, useUi } from "@/components/ui";
import { PlanDialog } from "@/components/PlanDialog";
import { api, cx, refreshAll } from "@/lib/client";
import { useMe } from "@/lib/hooks";
import { today, formatTime } from "@/lib/dates";
import type { AssistantAction } from "@/lib/nlp";
import type { ActionPreview } from "@/server/assistant";

type Proposal = { action: AssistantAction; preview: ActionPreview; state: "pending" | "done" | "dismissed" | "running"; result?: string };
type Msg = { id: number; role: "user" | "assistant"; text: string; proposals?: Proposal[]; source?: string };

const EXAMPLES = [
  "Demain, j'ai un cours particulier à 17 h.",
  "Je dois préparer un cours de mathématiques pour cet élève.",
  "Je veux travailler trois heures sur mon projet web cette semaine.",
  "Aujourd'hui, je suis très fatiguée.",
  "Je veux réviser l'allemand pendant 30 minutes.",
  "Ajoute une nouvelle catégorie appelée Lecture.",
  "Supprime cette activité.",
];

export default function AssistantPage() {
  const { data: me } = useMe();
  const { toast } = useUi();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: 0,
      role: "assistant",
      text: "Bonjour ! Dis-moi ce que tu veux organiser, en langage naturel. Je te proposerai les modifications et tu confirmeras avant que je fasse quoi que ce soit. 💙",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<{ id: string; date: string } | null>(null);
  const [plan, setPlan] = useState<{ date: string; light: boolean; energy?: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const id = Date.now();
    setMsgs((m) => [...m, { id, role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const r = await api<{ reply: string; actions: AssistantAction[]; previews: ActionPreview[]; source: string }>("/api/assistant", {
        body: { message: text, lastActivityId: last?.id, lastActivityDate: last?.date },
      });
      setMsgs((m) => [
        ...m,
        { id: id + 1, role: "assistant", text: r.reply, source: r.source, proposals: r.actions.map((a, i) => ({ action: a, preview: r.previews[i], state: "pending" })) },
      ]);
    } catch (e) {
      setMsgs((m) => [...m, { id: id + 1, role: "assistant", text: e instanceof Error ? e.message : "Je n'ai pas pu répondre. Réessaie dans un instant." }]);
    } finally {
      setLoading(false);
    }
  }

  function updateProposal(msgId: number, idx: number, patch: Partial<Proposal>) {
    setMsgs((m) => m.map((x) => (x.id === msgId ? { ...x, proposals: x.proposals?.map((p, i) => (i === idx ? { ...p, ...patch } : p)) } : x)));
  }

  async function confirmAction(msgId: number, idx: number, p: Proposal, override?: AssistantAction) {
    const action = override ?? p.action;
    if (action.type === "plan_day") {
      updateProposal(msgId, idx, { state: "done", result: "Proposition ouverte." });
      const energyAction = msgs.find((x) => x.id === msgId)?.proposals?.find((x) => x.action.type === "set_energy")?.action;
      setPlan({ date: action.data.date, light: !!action.data.light, energy: energyAction?.type === "set_energy" ? energyAction.data.energy : undefined });
      return;
    }
    updateProposal(msgId, idx, { state: "running" });
    try {
      const r = await api<{ message: string; activityId?: string; date?: string }>("/api/assistant/execute", { body: { action, confirmed: true } });
      if (r.activityId && r.date) setLast({ id: r.activityId, date: r.date });
      updateProposal(msgId, idx, { state: "done", result: r.message });
      await refreshAll();
    } catch (e) {
      updateProposal(msgId, idx, { state: "pending" });
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col lg:h-[calc(100vh-6rem)]">
      <PageHeader
        title="Assistant"
        subtitle={
          me?.aiEnabled ? (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-lavender" /> IA connectée (Claude) — repli automatique sur l&apos;analyseur local
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5" /> Mode local : analyseur de phrases intégré (aucune clé IA configurée)
            </span>
          )
        }
      />
      <div className="card flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {msgs.map((m) => (
            <div key={m.id} className={cx("flex gap-3", m.role === "user" && "justify-end")}>
              {m.role === "assistant" && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-lavender-soft text-lavender">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div className={cx("max-w-[85%] space-y-2", m.role === "user" && "items-end")}>
                <div className={cx("rounded-2xl px-4 py-2.5 text-sm", m.role === "user" ? "bg-primary-strong text-white dark:text-[#0e1322]" : "bg-surface-2 text-ink")}>{m.text}</div>
                {m.proposals?.map((p, i) => (
                  <div key={i} className={cx("rounded-2xl border p-3 text-sm animate-fade-in", p.preview.destructive ? "border-danger/40 bg-danger-soft/40" : "border-line bg-surface")}>
                    <div className="flex items-start gap-2">
                      {p.preview.destructive ? <AlertTriangle className="mt-0.5 h-4 w-4 text-danger" /> : <Sparkles className="mt-0.5 h-4 w-4 text-lavender" />}
                      <div className="flex-1">
                        <div className="font-medium text-ink">{p.preview.summary}</div>
                        {p.preview.warnings.map((w) => (
                          <div key={w} className="mt-1 text-xs text-warning">
                            {w}
                          </div>
                        ))}
                        {p.result && <div className="mt-1 text-xs text-success">✓ {p.result}</div>}
                      </div>
                    </div>
                    {p.state === "pending" && !(p.preview.resolved as { notFound?: boolean } | undefined)?.notFound && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(() => {
                          const alt = (p.preview.resolved as { alternative?: { date: string; startTime: string } } | undefined)?.alternative;
                          if (alt && p.action.type === "create_activity") {
                            const a = p.action;
                            return (
                              <Button size="sm" onClick={() => confirmAction(m.id, i, p, { ...a, data: { ...a.data, date: alt.date, startTime: alt.startTime } })}>
                                <Check className="h-3.5 w-3.5" /> Utiliser le créneau libre ({formatTime(alt.startTime)})
                              </Button>
                            );
                          }
                          return null;
                        })()}
                        <Button size="sm" variant={p.preview.destructive ? "danger" : (p.preview.resolved as { alternative?: unknown } | undefined)?.alternative ? "secondary" : "primary"} onClick={() => confirmAction(m.id, i, p)}>
                          <Check className="h-3.5 w-3.5" /> {p.preview.destructive ? "Oui, supprimer" : p.preview.warnings.length ? "Confirmer quand même" : "Confirmer"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateProposal(m.id, i, { state: "dismissed" })}>
                          <X className="h-3.5 w-3.5" /> Ignorer
                        </Button>
                      </div>
                    )}
                    {p.state === "running" && <Spinner className="mt-2 h-4 w-4" />}
                    {p.state === "dismissed" && <div className="mt-2 text-xs text-muted">Ignoré.</div>}
                  </div>
                ))}
                {m.source && (
                  <Badge tone={m.source === "ai" ? "lavender" : "neutral"} className="text-[10px]">
                    {m.source === "ai" ? "Claude" : "analyse locale"}
                  </Badge>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner className="h-4 w-4" /> Je réfléchis…
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t border-line/70 p-3">
          <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => send(e)} className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-xs text-ink-2 hover:bg-primary-soft">
                {e}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2"
          >
            <input className="input text-base" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Écris naturellement… ex. « Jeudi, sport à 18 h 30 »" maxLength={1000} aria-label="Message" />
            <Button disabled={!input.trim() || loading} aria-label="Envoyer">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
      {plan && <PlanDialog open onClose={() => setPlan(null)} date={plan.date || today()} light={plan.light} defaultEnergy={plan.energy} />}
    </div>
  );
}
