"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, CalendarClock, CheckCircle2, Copy, MapPin, Pencil, Trash2, UserX, XCircle } from "lucide-react";
import { api, ApiError, fullName, refreshAll, useApi } from "@/lib/client";
import { SESSION_STATUS } from "@/lib/constants";
import { addDays, duration, formatMinutes, fromMinutes, longDate, toMinutes } from "@/lib/dates";
import { formatDT } from "@/lib/money";
import type { Session } from "@/lib/types";
import { Badge, Button, Checkbox, Dialog, Field, Input, Loading, Textarea, useConfirm, useToast } from "./ui";
import { StatusBadge } from "./shared";
import { SessionForm } from "./SessionForm";

export function SessionDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: s, mutate } = useApi<Session>(id ? `/api/sessions/${id}` : null);
  const toast = useToast();
  const confirm = useConfirm();
  const [edit, setEdit] = useState(false);
  const [move, setMove] = useState<null | "postpone" | "duplicate">(null);
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setReport(s?.report ?? ""), [s?.id, s?.report]);

  const patch = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true);
    try {
      await api(`/api/sessions/${id}`, { method: "PATCH", body });
      toast.success(msg);
      await mutate();
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    const series = s?.seriesId;
    const ok = await confirm({ title: "Supprimer cette séance ?", text: s?.invoices.length ? "Elle a été facturée : la facture sera annulée et l'opération restera tracée dans le journal financier." : "Cette action est définitive.", confirm: "Supprimer", danger: true });
    if (ok === false) return;
    let scope = "";
    if (series && (await confirm({ title: "Séance récurrente", text: "Supprimer aussi toutes les séances suivantes prévues de cette série ?", confirm: "Oui, les suivantes aussi" })) !== false) scope = "?scope=following";
    await api(`/api/sessions/${id}${scope}`, { method: "DELETE" });
    toast.success("Séance supprimée.");
    await refreshAll();
    onClose();
  };

  const mins = s ? duration(s.startTime, s.endTime) : 0;
  const isBilled = (s?.invoices.length ?? 0) > 0;
  return (
    <>
      <Dialog
        open={!!id && !edit}
        onClose={onClose}
        size="md"
        title={s ? s.title || s.participants.map((p) => fullName(p.student)).join(", ") : "Séance"}
        description={s ? `${longDate(s.date)} · ${s.startTime}–${s.endTime} (${formatMinutes(mins)})` : undefined}
        footer={
          s && (
            <>
              <Button variant="danger-ghost" onClick={remove}><Trash2 className="h-4 w-4" />Supprimer</Button>
              <Button variant="secondary" onClick={() => setMove("duplicate")}><Copy className="h-4 w-4" />Dupliquer</Button>
              <Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Modifier</Button>
            </>
          )
        }
      >
        {!s ? (
          <Loading rows={3} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={s.status} />
              {s.subject && <Badge tone="info">{s.subject.name}</Badge>}
              {s.level && <Badge>{s.level.name}</Badge>}
              {s.prepared ? <Badge tone="success">Préparée</Badge> : s.status === "PLANNED" && <Badge tone="warning">À préparer</Badge>}
              {isBilled && <Badge tone="accent">Facturée : {formatDT(s.invoices.reduce((a, i) => a + Number(i.amount), 0))}</Badge>}
              {s.location && <span className="inline-flex items-center gap-1 text-xs text-muted"><MapPin className="h-3.5 w-3.5" />{s.location}</span>}
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium text-muted">Changer le statut</div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant={s.status === "DONE" ? "success" : "secondary"} disabled={busy} onClick={() => patch({ status: "DONE" }, "Séance effectuée : facturation et suivi mis à jour.")}><CheckCircle2 className="h-4 w-4" />Effectuée</Button>
                <Button size="sm" variant={s.status === "STUDENT_ABSENT" ? "danger" : "secondary"} disabled={busy} onClick={() => patch({ status: "STUDENT_ABSENT" }, "Absence de l'élève enregistrée.")}><UserX className="h-4 w-4" />Absence élève</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setMove("postpone")}><CalendarClock className="h-4 w-4" />Reporter</Button>
                <Button size="sm" variant={s.status === "CANCELLED" ? "soft" : "secondary"} disabled={busy} onClick={() => patch({ status: "CANCELLED" }, "Séance annulée (non facturée).")}><XCircle className="h-4 w-4" />Annuler</Button>
                {(["PLANNED", "TEACHER_ABSENT"] as const).filter((k) => k !== s.status).map((k) => (
                  <Button key={k} size="sm" variant="ghost" disabled={busy} onClick={() => patch({ status: k }, `Statut : ${SESSION_STATUS[k].label}.`)}>{SESSION_STATUS[k].label}</Button>
                ))}
              </div>
              {s.status === "STUDENT_ABSENT" && (
                <Checkbox className="mt-2" checked={s.lateAbsenceBillable} onChange={(b) => patch({ lateAbsenceBillable: b }, b ? "Absence facturée." : "Absence non facturée.")} label="Absence tardive facturable" />
              )}
              {s.status === "POSTPONED" && s.postponedToId && <p className="mt-2 text-xs text-muted">Une séance de remplacement a été programmée.</p>}
            </div>

            <div className="grid gap-2 rounded-2xl bg-surface-2/60 p-3 text-sm">
              {s.participants.map((p) => (
                <div key={p.studentId} className="flex items-center justify-between gap-2">
                  <Link href={`/eleves/${p.studentId}`} className="font-medium hover:underline">{fullName(p.student)}</Link>
                  <span className="text-xs text-muted">{p.absent && "absent · "}{formatDT(Number(p.price))}{p.student.billingMode === "MONTHLY" && " · forfait"}</span>
                </div>
              ))}
            </div>
            {(s.chapter || s.objectives || s.preparationNeeded || s.notes) && (
              <dl className="grid gap-2 text-sm">
                {s.chapter && <div><dt className="text-xs text-muted">Chapitre</dt><dd>{s.chapter}</dd></div>}
                {s.objectives && <div><dt className="text-xs text-muted">Objectifs</dt><dd className="whitespace-pre-line">{s.objectives}</dd></div>}
                {s.preparationNeeded && <div><dt className="text-xs text-muted">Préparation nécessaire</dt><dd className="whitespace-pre-line">{s.preparationNeeded}</dd></div>}
                {s.notes && <div><dt className="text-xs text-muted">Remarques</dt><dd className="whitespace-pre-line">{s.notes}</dd></div>}
              </dl>
            )}
            {s.lessons.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {s.lessons.map((l) => (
                  <Link key={l.lesson.id} href={`/preparations?lesson=${l.lesson.id}`} className="chip bg-primary-soft text-primary-strong"><BookOpen className="h-3 w-3" />{l.lesson.title}</Link>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
              <Checkbox checked={s.prepared} onChange={(b) => patch({ prepared: b }, b ? "Marquée comme préparée." : "Marquée à préparer.")} label="Séance préparée" />
            </div>
            <Field label="Compte rendu / remarques après la séance">
              <Textarea rows={3} value={report} onChange={(e) => setReport(e.target.value)} placeholder="Notions vues, difficultés, devoirs donnés…" />
            </Field>
            {report !== (s.report ?? "") && <Button size="sm" onClick={() => patch({ report }, "Compte rendu enregistré.")} loading={busy}>Enregistrer le compte rendu</Button>}
          </div>
        )}
      </Dialog>
      <SessionForm open={edit} onClose={() => { setEdit(false); mutate(); }} session={s} />
      {s && move && <MoveDialog session={s} mode={move} onClose={() => setMove(null)} onDone={async () => { setMove(null); await mutate(); await refreshAll(); }} />}
    </>
  );
}

function MoveDialog({ session, mode, onClose, onDone }: { session: Session; mode: "postpone" | "duplicate"; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const mins = duration(session.startTime, session.endTime);
  const [v, setV] = useState({ date: addDays(session.date, 7), startTime: session.startTime });
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async (force = false) => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/sessions/${session.id}/${mode}`, { body: { date: v.date, startTime: v.startTime, endTime: fromMinutes(toMinutes(v.startTime) + mins), force } });
      toast.success(mode === "postpone" ? "Séance reportée et reprogrammée." : "Séance dupliquée.");
      onDone();
    } catch (e) {
      setConflict(e instanceof ApiError && e.status === 409);
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={mode === "postpone" ? "Reporter la séance" : "Dupliquer la séance"}
      description={mode === "postpone" ? "La séance actuelle passe en « Reportée » (non facturée) et une nouvelle séance est créée." : "Même élève(s), même contenu, nouvelle date."}
      footer={
        <>
          {conflict && <Button variant="danger-ghost" onClick={() => go(true)} loading={busy}>Malgré le conflit</Button>}
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={() => go()} loading={busy}>Valider</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nouvelle date"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
        <Field label="Heure" hint={`Fin : ${fromMinutes(toMinutes(v.startTime || "00:00") + mins)}`}><Input type="time" value={v.startTime} onChange={(e) => setV({ ...v, startTime: e.target.value })} /></Field>
      </div>
      {err && <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
    </Dialog>
  );
}
