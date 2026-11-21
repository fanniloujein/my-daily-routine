"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/client";
import { PERSONAL_EVENT_KINDS } from "@/lib/constants";
import { addDays, today } from "@/lib/dates";
import type { PersonalEvent } from "@/lib/types";
import { Button, Checkbox, Dialog, Field, Input, Select, Textarea, useConfirm, useToast } from "./ui";
import type { SessionDraft } from "./SessionForm";

export function PersonalEventDialog({ draft, onClose }: { draft: SessionDraft & { ev?: PersonalEvent }; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const ev = draft.ev;
  const [v, setV] = useState({
    title: ev?.title ?? "", kind: ev?.kind ?? "REST", date: ev ? (ev.weeklyUntil ? ev.date : ev.date) : draft.date ?? today(),
    startTime: ev?.startTime ?? draft.startTime ?? "12:30", endTime: ev?.endTime ?? draft.endTime ?? "13:30", weekly: !!ev?.weeklyUntil, weeklyUntil: ev?.weeklyUntil ?? addDays(today(), 90), notes: ev?.notes ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const save = async (force = false) => {
    const body = { title: v.title || PERSONAL_EVENT_KINDS[v.kind as keyof typeof PERSONAL_EVENT_KINDS], kind: v.kind, date: v.date, startTime: v.startTime, endTime: v.endTime, weeklyUntil: v.weekly ? v.weeklyUntil : null, notes: v.notes, force };
    try {
      if (ev) await api(`/api/personal-events/${ev.id}`, { method: "PUT", body });
      else await api("/api/personal-events", { body });
      toast.success("Enregistré dans le calendrier.");
      onClose();
    } catch (e) {
      setConflict(e instanceof ApiError && e.status === 409);
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  };
  const remove = async () => {
    if ((await confirm({ title: "Supprimer cet événement ?", text: ev?.weeklyUntil ? "Toutes les répétitions hebdomadaires seront supprimées." : undefined, danger: true })) === false) return;
    await api(`/api/personal-events/${ev!.id}`, { method: "DELETE" });
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={ev ? "Modifier l'événement" : "Repos, pause ou événement"}
      description="Ces créneaux sont protégés : aucun cours ne peut y être programmé sans votre accord."
      footer={<>{ev && <Button variant="danger-ghost" onClick={remove}>Supprimer</Button>}{conflict && <Button variant="danger-ghost" onClick={() => save(true)}>Malgré le conflit</Button>}<Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => save()}>Enregistrer</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type"><Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })} options={PERSONAL_EVENT_KINDS} /></Field>
        <Field label="Titre"><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Ex. Pause déjeuner" /></Field>
        <Field label="Date"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Début"><Input type="time" value={v.startTime} onChange={(e) => setV({ ...v, startTime: e.target.value })} /></Field>
          <Field label="Fin"><Input type="time" value={v.endTime} onChange={(e) => setV({ ...v, endTime: e.target.value })} /></Field>
        </div>
        <Checkbox className="sm:col-span-2" checked={v.weekly} onChange={(weekly) => setV({ ...v, weekly })} label="Répéter chaque semaine" />
        {v.weekly && <Field label="Jusqu'au"><Input type="date" value={v.weeklyUntil} onChange={(e) => setV({ ...v, weeklyUntil: e.target.value })} /></Field>}
        <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
      </div>
      {err && <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
    </Dialog>
  );
}
