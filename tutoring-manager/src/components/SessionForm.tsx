"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Repeat, Trash2, Users } from "lucide-react";
import { api, ApiError, fullName, refreshAll, useApi } from "@/lib/client";
import { SESSION_STATUS } from "@/lib/constants";
import { duration, formatMinutes, fromMinutes, shortDate, today, toMinutes, weekday, weekdayName, addDays } from "@/lib/dates";
import { formatDT } from "@/lib/money";
import type { Session } from "@/lib/types";
import { Button, Checkbox, Dialog, Field, Input, Select, Textarea, useToast } from "./ui";
import { useRefs } from "./shared";

type Conflict = { date: string; startTime: string; endTime: string; with: string[] };
type Lessons = { id: string; title: string; chapter: { title: string; subject: { name: string } } }[];

export type SessionDraft = Partial<{ date: string; startTime: string; endTime: string; studentId: string }>;

export function SessionForm({ open, onClose, session, draft, onSaved }: { open: boolean; onClose: () => void; session?: Session | null; draft?: SessionDraft; onSaved?: () => void }) {
  const refs = useRefs();
  const toast = useToast();
  const lessons = useApi<Lessons>(open ? "/api/lessons" : null);
  const { data: me } = useApi<{ settings: { defaultDuration: number; defaultLocation: string; lateAbsenceBillableDefault: boolean } }>("/api/me");
  const empty = () => ({
    title: "",
    participants: [] as { studentId: string; price: number; absent: boolean }[],
    subjectId: "",
    levelId: "",
    date: draft?.date ?? today(),
    startTime: draft?.startTime ?? "14:00",
    endTime: draft?.endTime ?? fromMinutes(toMinutes(draft?.startTime ?? "14:00") + (me?.settings.defaultDuration ?? 60)),
    location: me?.settings.defaultLocation ?? "",
    chapter: "",
    objectives: "",
    preparationNeeded: "",
    prepared: false,
    notes: "",
    report: "",
    status: "PLANNED" as Session["status"],
    lateAbsenceBillable: me?.settings.lateAbsenceBillableDefault ?? false,
    lessonIds: [] as string[],
    repeatOn: false,
    weekdays: [] as number[],
    until: "",
  });
  const [v, setV] = useState(empty);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState("");

  // Initialisation à l'ouverture
  useEffect(() => {
    if (!open) return;
    setError(null);
    setConflicts([]);
    if (session) {
      setV({
        ...empty(),
        title: session.title ?? "",
        participants: session.participants.map((p) => ({ studentId: p.studentId, price: Number(p.price), absent: p.absent })),
        subjectId: session.subjectId ?? "",
        levelId: session.levelId ?? "",
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        location: session.location ?? "",
        chapter: session.chapter ?? "",
        objectives: session.objectives ?? "",
        preparationNeeded: session.preparationNeeded ?? "",
        prepared: session.prepared,
        notes: session.notes ?? "",
        report: session.report ?? "",
        status: session.status,
        lateAbsenceBillable: session.lateAbsenceBillable,
        lessonIds: session.lessons.map((l) => l.lesson.id),
      });
    } else {
      const base = empty();
      setV({ ...base, weekdays: [weekday(base.date)], until: addDays(base.date, 7 * 12) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id]);

  // Élève proposé (depuis une fiche élève)
  useEffect(() => {
    if (open && !session && draft?.studentId && refs.students.length && !v.participants.length) addStudent(draft.studentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refs.students.length, draft?.studentId]);

  const addStudent = (id: string) => {
    const s = refs.students.find((x) => x.id === id);
    if (!s || v.participants.some((p) => p.studentId === id)) return;
    setV((cur) => {
      const first = cur.participants.length === 0;
      const subjectId = cur.subjectId || (s.subjects[0]?.id ?? "");
      return {
        ...cur,
        participants: [...cur.participants, { studentId: id, price: Number(s.rate), absent: false }],
        subjectId,
        levelId: cur.levelId || (s.levelId ?? ""),
        endTime: first && !session ? fromMinutes(toMinutes(cur.startTime) + s.sessionDuration) : cur.endTime,
      };
    });
    setPick("");
  };

  const mins = duration(v.startTime || "00:00", v.endTime || "00:00");
  const dates = useMemo(() => {
    if (session || !v.repeatOn || !v.until || !v.weekdays.length) return [v.date];
    const out: string[] = [];
    for (let d = v.date; d <= v.until && out.length < 200; d = addDays(d, 1)) if (v.weekdays.includes(weekday(d))) out.push(d);
    return out;
  }, [session, v.repeatOn, v.until, v.weekdays, v.date]);

  // Vérification des conflits pendant la saisie
  useEffect(() => {
    if (!open || mins <= 0 || !v.date) return;
    const h = setTimeout(() => {
      api<Conflict[]>("/api/sessions/conflicts", { body: { excludeId: session?.id, slots: dates.map((date) => ({ date, startTime: v.startTime, endTime: v.endTime })) } })
        .then(setConflicts)
        .catch(() => {});
    }, 350);
    return () => clearTimeout(h);
  }, [open, dates, v.startTime, v.endTime, v.date, mins, session?.id]);

  const total = v.participants.reduce((a, p) => a + (Number(p.price) || 0), 0);

  const save = async (mode: "normal" | "force" | "skip" = "normal") => {
    setSaving(true);
    setError(null);
    const payload = {
      title: v.title,
      participants: v.participants.map((p) => ({ ...p, price: Number(p.price) })),
      subjectId: v.subjectId,
      levelId: v.levelId,
      date: v.date,
      startTime: v.startTime,
      endTime: v.endTime,
      location: v.location,
      chapter: v.chapter,
      objectives: v.objectives,
      preparationNeeded: v.preparationNeeded,
      prepared: v.prepared,
      notes: v.notes,
      report: v.report,
      status: v.status,
      lateAbsenceBillable: v.lateAbsenceBillable,
      lessonIds: v.lessonIds,
      repeat: !session && v.repeatOn ? { weekdays: v.weekdays, until: v.until } : null,
      force: mode === "force",
      skipConflicts: mode === "skip",
    };
    try {
      if (session) await api(`/api/sessions/${session.id}`, { method: "PUT", body: payload });
      else {
        const r = await api<{ created: number; skipped: number }>("/api/sessions", { body: payload });
        toast.success(r.created > 1 ? `${r.created} séances programmées${r.skipped ? ` (${r.skipped} date(s) en conflit ignorée(s))` : ""}.` : "Séance enregistrée.");
      }
      if (session) toast.success("Séance modifiée.");
      await refreshAll();
      onSaved?.();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && Array.isArray(e.data?.conflicts)) setConflicts(e.data!.conflicts as Conflict[]);
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((cur) => ({ ...cur, [k]: val }));
  const available = refs.students.filter((s) => !v.participants.some((p) => p.studentId === s.id));
  const billingNote = v.status === "DONE" ? "Facturation automatique à l'enregistrement (sauf forfait mensuel)." : v.status === "STUDENT_ABSENT" ? (v.lateAbsenceBillable ? "Absence facturée." : "Absence non facturée.") : v.status === "PLANNED" ? "Facturée quand vous la marquerez « effectuée »." : "Non facturée.";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={session ? "Modifier la séance" : "Nouvelle séance"}
      description={session ? `${shortDate(session.date)} · ${session.startTime}–${session.endTime}` : "Programmez un cours unique ou récurrent."}
      footer={
        <>
          {conflicts.length > 0 && (
            <>
              {!session && dates.length > 1 && conflicts.length < dates.length && (
                <Button variant="secondary" onClick={() => save("skip")} loading={saving}>Ignorer les dates en conflit</Button>
              )}
              <Button variant="danger-ghost" onClick={() => save("force")} loading={saving}>Enregistrer malgré le conflit</Button>
            </>
          )}
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={() => save()} loading={saving} disabled={!v.participants.length || mins <= 0 || conflicts.length > 0}>
            {session ? "Enregistrer" : dates.length > 1 ? `Programmer ${dates.length} séances` : "Programmer"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><Users className="h-4 w-4 text-primary-strong" />Élève ou groupe</div>
          <div className="space-y-2">
            {v.participants.map((p, i) => {
              const s = refs.students.find((x) => x.id === p.studentId);
              return (
                <div key={p.studentId} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/40 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{s ? fullName(s) : "…"}</span>
                  {s?.billingMode === "MONTHLY" && <span className="text-xs text-muted">forfait mensuel</span>}
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0} step="0.5" value={p.price} onChange={(e) => set("participants", v.participants.map((x, j) => (j === i ? { ...x, price: e.target.value as unknown as number } : x)))} className="h-8 w-24 text-right" aria-label="Tarif" />
                    <span className="text-xs text-muted">DT</span>
                  </div>
                  {v.participants.length > 1 && <Checkbox checked={p.absent} onChange={(absent) => set("participants", v.participants.map((x, j) => (j === i ? { ...x, absent } : x)))} label={<span className="text-xs">absent</span>} />}
                  <Button size="icon-sm" variant="ghost" onClick={() => set("participants", v.participants.filter((_, j) => j !== i))} aria-label="Retirer"><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
            <div className="flex gap-2">
              <Select value={pick} onChange={(e) => addStudent(e.target.value)} options={available.map((s) => ({ value: s.id, label: `${fullName(s)}${s.level ? ` — ${s.level.name}` : ""}` }))} placeholder={v.participants.length ? "+ Ajouter un élève (séance collective)" : "Choisir un élève…"} />
            </div>
            {v.participants.length > 1 && (
              <Field label="Nom du groupe"><Input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex. Groupe Physique 8ème" /></Field>
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Matière"><Select value={v.subjectId} onChange={(e) => set("subjectId", e.target.value)} options={refs.subjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="—" /></Field>
          <Field label="Niveau"><Select value={v.levelId} onChange={(e) => set("levelId", e.target.value)} options={refs.levels.map((s) => ({ value: s.id, label: s.name }))} placeholder="—" /></Field>
          <Field label="Date" required><Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Début" required><Input type="time" value={v.startTime} onChange={(e) => { const keep = mins > 0 ? mins : 60; setV((c) => ({ ...c, startTime: e.target.value, endTime: e.target.value ? fromMinutes(toMinutes(e.target.value) + keep) : c.endTime })); }} /></Field>
            <Field label="Fin" required error={mins <= 0 ? "Après le début" : null} hint={mins > 0 ? `Durée : ${formatMinutes(mins)}` : undefined}><Input type="time" value={v.endTime} onChange={(e) => set("endTime", e.target.value)} /></Field>
          </div>
          <Field label="Lieu du cours"><Input value={v.location} onChange={(e) => set("location", e.target.value)} placeholder="Domicile, en ligne, salle…" /></Field>
          <Field label="Statut">
            <Select value={v.status} onChange={(e) => set("status", e.target.value as Session["status"])} options={Object.fromEntries(Object.entries(SESSION_STATUS).map(([k, s]) => [k, s.label]))} disabled={!session && v.repeatOn} />
          </Field>
        </section>

        <div className="rounded-xl bg-beige/60 px-3 py-2 text-xs text-ink-2">
          Tarif total : <b>{formatDT(total)}</b> · {billingNote}
          {(v.status === "STUDENT_ABSENT" || v.participants.some((p) => p.absent)) && (
            <Checkbox className="mt-1.5" checked={v.lateAbsenceBillable} onChange={(b) => set("lateAbsenceBillable", b)} label="Absence tardive facturable (prévenue trop tard)" />
          )}
        </div>

        {!session && (
          <section className="rounded-2xl border border-line p-3">
            <Checkbox checked={v.repeatOn} onChange={(b) => set("repeatOn", b)} label={<span className="inline-flex items-center gap-1.5 font-medium"><Repeat className="h-4 w-4" />Séance récurrente</span>} />
            {v.repeatOn && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <button key={d} type="button" onClick={() => set("weekdays", v.weekdays.includes(d) ? v.weekdays.filter((x) => x !== d) : [...v.weekdays, d])} className={`rounded-lg border px-2.5 py-1 text-xs capitalize ${v.weekdays.includes(d) ? "border-primary-strong bg-primary-soft text-primary-strong" : "border-line text-muted"}`}>
                      {weekdayName(d).slice(0, 3)}
                    </button>
                  ))}
                </div>
                <Field label="Jusqu'au" hint={`${dates.length} séance(s) seront créées${dates.length >= 200 ? " (maximum)" : ""}.`}><Input type="date" value={v.until} onChange={(e) => set("until", e.target.value)} /></Field>
              </div>
            )}
          </section>
        )}

        {conflicts.length > 0 && (
          <div className="rounded-2xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <div className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" />Créneau déjà occupé ({conflicts.length})</div>
            <ul className="mt-1 space-y-0.5 text-xs">
              {conflicts.slice(0, 6).map((c, i) => <li key={i}>{shortDate(c.date)} {c.startTime}–{c.endTime} : {c.with.join(", ")}</li>)}
              {conflicts.length > 6 && <li>… et {conflicts.length - 6} autre(s)</li>}
            </ul>
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Chapitre étudié"><Input value={v.chapter} onChange={(e) => set("chapter", e.target.value)} /></Field>
          <Field label="Préparations liées">
            <Select value="" onChange={(e) => e.target.value && !v.lessonIds.includes(e.target.value) && set("lessonIds", [...v.lessonIds, e.target.value])} options={(lessons.data ?? []).map((l) => ({ value: l.id, label: `${l.chapter.subject.name} · ${l.title}` }))} placeholder="+ Rattacher une préparation" />
            {v.lessonIds.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {v.lessonIds.map((id) => (
                  <button key={id} type="button" onClick={() => set("lessonIds", v.lessonIds.filter((x) => x !== id))} className="chip bg-primary-soft text-primary-strong">
                    {lessons.data?.find((l) => l.id === id)?.title ?? session?.lessons.find((l) => l.lesson.id === id)?.lesson.title ?? "…"} ×
                  </button>
                ))}
              </div>
            )}
          </Field>
          <Field label="Objectifs" className="sm:col-span-2"><Textarea rows={2} value={v.objectives} onChange={(e) => set("objectives", e.target.value)} /></Field>
          <Field label="Préparation nécessaire"><Textarea rows={2} value={v.preparationNeeded} onChange={(e) => set("preparationNeeded", e.target.value)} placeholder="Imprimer, préparer une fiche…" /></Field>
          <Field label="Remarques"><Textarea rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          {session && <Field label="Compte rendu après séance (suivi pédagogique)" className="sm:col-span-2"><Textarea rows={2} value={v.report} onChange={(e) => set("report", e.target.value)} /></Field>}
          <Checkbox checked={v.prepared} onChange={(b) => set("prepared", b)} label="Séance préparée" />
        </section>
        {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}


