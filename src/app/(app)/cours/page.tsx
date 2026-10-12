"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, CalendarPlus, Check, ExternalLink, FileText, GraduationCap, Link2, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorBox, Field, Loading, Modal, Notice, PageHeader, Progress, Segmented, useUi } from "@/components/ui";
import { ApiError, api, cx, fmtDateLong, fmtDayNum, refreshAll, relativeDay, useApi } from "@/lib/client";
import { addDays, addMinutesToTime, formatDuration, formatTime, timeToMin, today } from "@/lib/dates";
import { COLOR_PALETTE } from "@/lib/constants";
import type { Readiness } from "@/server/lessons";

type PrepItem = { id: string; label: string; done: boolean; order: number };
type Resource = { id: string; type: string; title: string; url: string | null; content: string | null };
type Student = { id: string; name: string; level: string | null; subjects: string | null; goals: string | null; notes: string | null; color: string; archived: boolean; lessonsDone: number; nextLesson: { date: string; startTime: string; subject: string } | null };
type Lesson = {
  id: string;
  studentId: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  chapter: string | null;
  status: "PLANNED" | "DONE" | "CANCELLED";
  prepMinutes: number;
  remarks: string | null;
  nextSteps: string | null;
  student: { id: string; name: string; color: string; level: string | null };
  prepItems: PrepItem[];
  resources: Resource[];
  activities: { id: string; lessonRole: string | null; date: string; startTime: string | null; status: string }[];
  readiness: Readiness;
};

const RES_TYPES: Record<string, string> = { COURS: "Cours", FICHE: "Fiche de révision", EXERCICE: "Exercices", DOCUMENT: "Document", LIEN: "Lien" };

export default function CoursPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Cours />
    </Suspense>
  );
}

function Cours() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "students" | "past">("upcoming");
  const [lessonForm, setLessonForm] = useState<{ studentId?: string } | null>(null);
  const [studentForm, setStudentForm] = useState<Partial<Student> | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("new") === "lesson") setLessonForm({});
    if (params.get("lesson")) setLessonId(params.get("lesson"));
    if (params.get("new") || params.get("lesson")) router.replace("/cours");
  }, [params, router]);

  const upcoming = useApi<Lesson[]>("/api/lessons?scope=upcoming");
  const past = useApi<Lesson[]>(tab === "past" ? "/api/lessons?scope=past" : null);
  const students = useApi<Student[]>("/api/students");

  return (
    <div>
      <PageHeader
        title="Cours particuliers"
        subtitle="Élèves, séances, préparations et suivi pédagogique."
        actions={
          <>
            <Button variant="secondary" onClick={() => setStudentForm({})}>
              <UserPlus className="h-4 w-4" /> Élève
            </Button>
            <Button onClick={() => setLessonForm({})}>
              <Plus className="h-4 w-4" /> Séance
            </Button>
          </>
        }
      />
      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "upcoming", label: "Séances à venir" },
          { value: "students", label: "Élèves" },
          { value: "past", label: "Séances réalisées" },
        ]}
      />

      {tab === "upcoming" &&
        (upcoming.error ? (
          <ErrorBox error={upcoming.error} />
        ) : !upcoming.data ? (
          <Loading />
        ) : upcoming.data.length === 0 ? (
          <Empty icon={<GraduationCap className="h-8 w-8" />} title="Aucune séance à venir" action={<Button size="sm" onClick={() => setLessonForm({})}>Planifier une séance</Button>}>
            {students.data?.length ? "Planifie une séance : la préparation sera réservée automatiquement avant." : "Commence par ajouter un·e élève."}
          </Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.data.map((l) => (
              <LessonCard key={l.id} l={l} onOpen={() => setLessonId(l.id)} />
            ))}
          </div>
        ))}

      {tab === "students" &&
        (!students.data ? (
          <Loading />
        ) : students.data.length === 0 ? (
          <Empty icon={<Users className="h-8 w-8" />} title="Aucun·e élève" action={<Button size="sm" onClick={() => setStudentForm({})}>Ajouter un·e élève</Button>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {students.data.map((s) => (
              <button key={s.id} onClick={() => setStudentId(s.id)} className={cx("card p-4 text-left transition hover:shadow-pop", s.archived && "opacity-60")}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl font-display text-lg font-semibold text-white" style={{ background: s.color }}>
                    {s.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{s.name}</div>
                    <div className="truncate text-xs text-muted">
                      {s.level ?? "Niveau non précisé"} · {s.subjects ?? "—"}
                    </div>
                  </div>
                </div>
                {s.goals && <p className="mt-3 line-clamp-2 text-xs text-ink-2">🎯 {s.goals}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge>{s.lessonsDone} séance(s) réalisée(s)</Badge>
                  {s.nextLesson && <Badge tone="primary">Prochaine : {relativeDay(s.nextLesson.date, today())} {formatTime(s.nextLesson.startTime)}</Badge>}
                  {s.archived && <Badge>Archivé·e</Badge>}
                </div>
              </button>
            ))}
          </div>
        ))}

      {tab === "past" &&
        (!past.data ? (
          <Loading />
        ) : past.data.length === 0 ? (
          <Empty title="Aucune séance passée" />
        ) : (
          <Card>
            <ul className="divide-y divide-line/60">
              {past.data.map((l) => (
                <li key={l.id}>
                  <button onClick={() => setLessonId(l.id)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">
                        {l.student.name} — {l.subject}
                        {l.chapter ? ` · ${l.chapter}` : ""}
                      </div>
                      <div className="truncate text-xs text-muted">{l.remarks ?? "Pas encore de remarque"}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted">{fmtDayNum(l.date)}</span>
                      <Badge tone={l.status === "DONE" ? "success" : l.status === "CANCELLED" ? "neutral" : "warning"}>
                        {l.status === "DONE" ? "Réalisée" : l.status === "CANCELLED" ? "Annulée" : "À clôturer"}
                      </Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))}

      {lessonForm && <LessonForm open studentId={lessonForm.studentId} students={students.data ?? []} onClose={() => setLessonForm(null)} onNeedStudent={() => { setLessonForm(null); setStudentForm({}); }} />}
      {studentForm && <StudentForm open initial={studentForm} onClose={() => setStudentForm(null)} />}
      {lessonId && <LessonDetail id={lessonId} onClose={() => setLessonId(null)} />}
      {studentId && (
        <StudentDetail
          id={studentId}
          onClose={() => setStudentId(null)}
          onEdit={(s) => { setStudentId(null); setStudentForm(s); }}
          onNewLesson={() => { const id = studentId; setStudentId(null); setLessonForm({ studentId: id }); }}
          onOpenLesson={(id) => { setStudentId(null); setLessonId(id); }}
        />
      )}
    </div>
  );
}

function ReadinessBadge({ r }: { r: Readiness }) {
  if (r.state === "ready") return <Badge tone="success">Prête ✓</Badge>;
  if (r.state === "at_risk") return <Badge tone="warning">Risque de ne pas être prête</Badge>;
  if (r.state === "past") return <Badge>Passée</Badge>;
  return <Badge tone="primary">Préparation en cours</Badge>;
}

function LessonCard({ l, onOpen }: { l: Lesson; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card p-4 text-left transition hover:shadow-pop">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium text-ink">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.student.color }} /> {l.student.name}
          </div>
          <div className="mt-0.5 text-sm text-ink-2">
            {l.subject}
            {l.chapter ? ` — ${l.chapter}` : ""}
          </div>
        </div>
        <ReadinessBadge r={l.readiness} />
      </div>
      <div className="mt-3 text-xs first-letter:uppercase text-muted">
        {relativeDay(l.date, today())} · {formatTime(l.startTime)} – {formatTime(l.endTime)} · préparation {formatDuration(l.prepMinutes)}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Progress value={l.readiness.progress} tone={l.readiness.state === "at_risk" ? "warning" : "success"} className="flex-1" />
        <span className="text-[11px] text-muted">
          {l.prepItems.filter((i) => i.done).length}/{l.prepItems.length}
        </span>
      </div>
      <p className={cx("mt-2 text-[11px]", l.readiness.state === "at_risk" ? "text-warning" : "text-muted")}>{l.readiness.message}</p>
    </button>
  );
}

function LessonForm({ open, onClose, students, studentId, onNeedStudent }: { open: boolean; onClose: () => void; students: Student[]; studentId?: string; onNeedStudent: () => void }) {
  const { toast } = useUi();
  const active = students.filter((s) => !s.archived);
  const [f, setF] = useState({
    studentId: studentId ?? active[0]?.id ?? "",
    date: addDays(today(), 1),
    startTime: "16:00",
    endTime: "17:00",
    subject: "",
    chapter: "",
    prepMinutes: 60,
    prepDate: "",
    recurrenceWeeks: 0,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const student = students.find((s) => s.id === f.studentId);

  useEffect(() => {
    if (!f.studentId && active.length) setF((x) => ({ ...x, studentId: active[0].id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length]);

  useEffect(() => {
    if (student && !f.subject && student.subjects) setF((x) => ({ ...x, subject: student.subjects!.split(",")[0].trim() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.studentId]);

  async function save(allowConflict = false) {
    setErr(null);
    if (!f.studentId) return setErr("Choisis un·e élève.");
    if (!f.subject.trim()) return setErr("Indique la matière.");
    if (timeToMin(f.endTime) <= timeToMin(f.startTime)) return setErr("L'heure de fin doit être après le début.");
    setSaving(true);
    try {
      const r = await api<{ prepPlaced: { date: string; startTime: string } | null }>("/api/lessons", { body: { ...f, prepDate: f.prepDate || null, allowConflict } });
      await refreshAll();
      toast(
        f.prepMinutes > 0
          ? r.prepPlaced
            ? `Séance ajoutée. Préparation réservée le ${fmtDayNum(r.prepPlaced.date)} à ${formatTime(r.prepPlaced.startTime)} ✨`
            : "Séance ajoutée. Aucun créneau libre trouvé pour la préparation : elle est dans ta liste sans horaire."
          : "Séance ajoutée",
        r.prepPlaced || !f.prepMinutes ? "success" : "warning",
      );
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const c = e.data as { conflicts: { title: string; date: string; startTime: string }[]; suggestion: { date: string; startTime: string } | null };
        setConflict(`Conflit avec ${c.conflicts.map((x) => `« ${x.title} » (${fmtDayNum(x.date)} ${formatTime(x.startTime)})`).join(", ")}.${c.suggestion ? ` Créneau libre proposé : ${fmtDayNum(c.suggestion.date)} à ${formatTime(c.suggestion.startTime)}.` : ""}`);
      } else setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle séance" footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button>{conflict && <Button variant="secondary" onClick={() => save(true)}>Planifier quand même</Button>}<Button onClick={() => save(false)} loading={saving} disabled={!active.length}>Planifier</Button></>}>
      {active.length === 0 ? (
        <Empty title="Aucun·e élève" action={<Button size="sm" onClick={onNeedStudent}>Ajouter un·e élève</Button>} />
      ) : (
        <div className="space-y-3">
          {err && <Notice tone="danger">{err}</Notice>}
          {conflict && <Notice tone="warning">{conflict}</Notice>}
          <Field label="Élève">
            <select className="input" value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value, subject: "" })}>
              {active.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.level ? `(${s.level})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Matière">
              <input className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="Mathématiques" />
            </Field>
            <Field label="Chapitre">
              <input className="input" value={f.chapter} onChange={(e) => setF({ ...f, chapter: e.target.value })} placeholder="Théorème de Pythagore" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date">
              <input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </Field>
            <Field label="Début">
              <input type="time" className="input" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value, endTime: addMinutesToTime(e.target.value, timeToMin(f.endTime) - timeToMin(f.startTime)) })} />
            </Field>
            <Field label="Fin">
              <input type="time" className="input" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Temps de préparation (min)" hint="Réservé automatiquement avant la séance">
              <input type="number" min={0} step={15} className="input" value={f.prepMinutes} onChange={(e) => setF({ ...f, prepMinutes: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
            <Field label="Préparer le… (facultatif)" hint="Par défaut : la veille">
              <input type="date" className="input" value={f.prepDate} max={f.date} onChange={(e) => setF({ ...f, prepDate: e.target.value })} />
            </Field>
          </div>
          <Field label="Répéter chaque semaine" hint="Nombre de séances supplémentaires (0 = séance unique)">
            <input type="number" min={0} max={40} className="input" value={f.recurrenceWeeks} onChange={(e) => setF({ ...f, recurrenceWeeks: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })} />
          </Field>
          <p className="text-xs text-muted">Une checklist de préparation (programme, fiche, exemples, exercices, corrections, matériel) est créée automatiquement.</p>
        </div>
      )}
    </Modal>
  );
}

function StudentForm({ open, initial, onClose }: { open: boolean; initial: Partial<Student>; onClose: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({
    name: initial.name ?? "",
    level: initial.level ?? "",
    subjects: initial.subjects ?? "",
    goals: initial.goals ?? "",
    notes: initial.notes ?? "",
    color: initial.color ?? COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
    archived: initial.archived ?? false,
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!f.name.trim()) return toast("Le nom est obligatoire", "danger");
    setSaving(true);
    try {
      if (initial.id) await api(`/api/students/${initial.id}`, { method: "PATCH", body: f });
      else await api("/api/students", { body: f });
      await refreshAll();
      toast(initial.id ? "Élève modifié·e" : "Élève ajouté·e");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={initial.id ? "Modifier l'élève" : "Nouvel·le élève"} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} loading={saving}>Enregistrer</Button></>}>
      <div className="space-y-3">
        <Field label="Prénom / nom">
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Niveau scolaire">
            <input className="input" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} placeholder="3e, Terminale…" />
          </Field>
          <Field label="Matières">
            <input className="input" value={f.subjects} onChange={(e) => setF({ ...f, subjects: e.target.value })} placeholder="Maths, Physique" />
          </Field>
        </div>
        <Field label="Objectifs">
          <textarea className="input min-h-[60px]" value={f.goals} onChange={(e) => setF({ ...f, goals: e.target.value })} />
        </Field>
        <Field label="Notes">
          <textarea className="input min-h-[60px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <div>
          <span className="label">Couleur</span>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((c) => (
              <button key={c} type="button" onClick={() => setF({ ...f, color: c })} className={cx("h-7 w-7 rounded-full ring-offset-2 ring-offset-surface", f.color === c && "ring-2 ring-ink")} style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </div>
        {initial.id && (
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={f.archived} onChange={(e) => setF({ ...f, archived: e.target.checked })} /> Archiver (ne plus proposer pour de nouvelles séances)
          </label>
        )}
      </div>
    </Modal>
  );
}

function LessonDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { toast, confirm } = useUi();
  const { data: l, mutate } = useApi<Lesson>(`/api/lessons/${id}`);
  const [newItem, setNewItem] = useState("");
  const [remarks, setRemarks] = useState<string | null>(null);
  const [nextSteps, setNextSteps] = useState<string | null>(null);
  const [res, setRes] = useState({ type: "FICHE", title: "", url: "", content: "" });
  const [revisionDate, setRevisionDate] = useState(addDays(today(), 14));
  const [edit, setEdit] = useState(false);
  const [ef, setEf] = useState({ date: "", startTime: "", endTime: "", subject: "", chapter: "", prepMinutes: 60 });

  useEffect(() => {
    if (l) {
      setRemarks(l.remarks ?? "");
      setNextSteps(l.nextSteps ?? "");
      setEf({ date: l.date, startTime: l.startTime, endTime: l.endTime, subject: l.subject, chapter: l.chapter ?? "", prepMinutes: l.prepMinutes });
    }
  }, [l]);

  if (!l) return <Modal open onClose={onClose} title="Séance"><Loading /></Modal>;

  async function toggle(item: PrepItem) {
    await api(`/api/lessons/${id}/prep`, { method: "PATCH", body: { itemId: item.id, done: !item.done } });
    await mutate();
    refreshAll();
  }
  async function addItem() {
    if (!newItem.trim()) return;
    await api(`/api/lessons/${id}/prep`, { body: { label: newItem } });
    setNewItem("");
    mutate();
  }
  async function patch(body: Record<string, unknown>, msg: string) {
    try {
      await api(`/api/lessons/${id}`, { method: "PATCH", body });
      await mutate();
      await refreshAll();
      toast(msg);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const c = e.data as { conflicts: { title: string }[] };
        if (await confirm({ title: "Conflit d'horaire", message: `Ce créneau chevauche : ${c.conflicts.map((x) => x.title).join(", ")}. Enregistrer quand même ?`, confirmLabel: "Enregistrer quand même" }))
          return patch({ ...body, allowConflict: true }, msg);
        return;
      }
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }
  async function addResource() {
    if (!res.title.trim()) return toast("Titre requis", "danger");
    try {
      await api("/api/resources", { body: { ...res, lessonId: id } });
      setRes({ type: "FICHE", title: "", url: "", content: "" });
      mutate();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }
  async function planRevision() {
    const r = await api<{ placed: boolean }>(`/api/lessons/${id}/revision`, { body: { date: revisionDate, durationMin: 30, note: nextSteps || undefined } });
    await refreshAll();
    toast(r.placed ? `Révision planifiée le ${fmtDayNum(revisionDate)}` : `Révision ajoutée le ${fmtDayNum(revisionDate)} (sans horaire : aucun créneau libre)`);
  }
  async function del() {
    if (!(await confirm({ title: "Supprimer cette séance ?", message: "La séance, sa préparation et ses créneaux dans l'agenda seront supprimés.", danger: true, confirmLabel: "Supprimer" }))) return;
    await api(`/api/lessons/${id}`, { method: "DELETE" });
    await refreshAll();
    toast("Séance supprimée");
    onClose();
  }

  const prepAct = l.activities.find((a) => a.lessonRole === "prep");
  const isPast = l.date < today() || l.status !== "PLANNED";

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${l.student.name} — ${l.subject}`}
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-danger" onClick={del}>
            <Trash2 className="h-4 w-4" /> Supprimer
          </Button>
          {l.status === "PLANNED" && (
            <Button variant="secondary" onClick={() => patch({ status: "CANCELLED" }, "Séance annulée")}>
              Annuler la séance
            </Button>
          )}
          {l.status !== "DONE" ? (
            <Button variant="success" onClick={() => patch({ status: "DONE", remarks, nextSteps }, "Séance marquée comme réalisée 🎓")}>
              <Check className="h-4 w-4" /> Séance réalisée
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => patch({ status: "PLANNED" }, "Séance replanifiée")}>
              Remettre à venir
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm first-letter:uppercase text-ink-2">
            {fmtDateLong(l.date)} · {formatTime(l.startTime)} – {formatTime(l.endTime)}
            {l.chapter && <span className="normal-case"> · {l.chapter}</span>}
          </div>
          <div className="flex items-center gap-2">
            <ReadinessBadge r={l.readiness} />
            <Button size="sm" variant="ghost" onClick={() => setEdit(!edit)}>
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </Button>
          </div>
        </div>

        {edit && (
          <div className="grid gap-3 rounded-2xl bg-surface-2/60 p-3 sm:grid-cols-3">
            <Field label="Date"><input type="date" className="input" value={ef.date} onChange={(e) => setEf({ ...ef, date: e.target.value })} /></Field>
            <Field label="Début"><input type="time" className="input" value={ef.startTime} onChange={(e) => setEf({ ...ef, startTime: e.target.value })} /></Field>
            <Field label="Fin"><input type="time" className="input" value={ef.endTime} onChange={(e) => setEf({ ...ef, endTime: e.target.value })} /></Field>
            <Field label="Matière"><input className="input" value={ef.subject} onChange={(e) => setEf({ ...ef, subject: e.target.value })} /></Field>
            <Field label="Chapitre"><input className="input" value={ef.chapter} onChange={(e) => setEf({ ...ef, chapter: e.target.value })} /></Field>
            <Field label="Préparation (min)"><input type="number" className="input" value={ef.prepMinutes} onChange={(e) => setEf({ ...ef, prepMinutes: Number(e.target.value) || 0 })} /></Field>
            <div className="sm:col-span-3 flex justify-end">
              <Button size="sm" onClick={() => { patch({ ...ef, chapter: ef.chapter || null }, "Séance modifiée"); setEdit(false); }}>Enregistrer</Button>
            </div>
          </div>
        )}

        {l.readiness.state === "at_risk" && <Notice tone="warning">{l.readiness.message}</Notice>}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="section-title">Checklist de préparation</h3>
            <span className="text-xs text-muted">
              {formatDuration(l.prepMinutes)}
              {prepAct?.startTime ? ` · réservée le ${fmtDayNum(prepAct.date)} à ${formatTime(prepAct.startTime)}` : prepAct ? " · sans créneau" : ""}
            </span>
          </div>
          <Progress value={l.readiness.progress} tone="success" className="mb-3" />
          <ul className="space-y-1">
            {l.prepItems.map((i) => (
              <li key={i.id} className="group flex items-center gap-2">
                <button onClick={() => toggle(i)} className={cx("flex h-5 w-5 items-center justify-center rounded-md border-2", i.done ? "border-success bg-success text-white" : "border-line")} aria-label={i.label}>
                  {i.done && <Check className="h-3 w-3" strokeWidth={3} />}
                </button>
                <span className={cx("flex-1 text-sm", i.done ? "text-muted line-through" : "text-ink")}>{i.label}</span>
                <button
                  onClick={async () => { await api(`/api/lessons/${id}/prep?itemId=${i.id}`, { method: "DELETE" }); mutate(); }}
                  className="hidden text-muted hover:text-danger group-hover:block"
                  aria-label="Supprimer l'étape"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addItem(); }}>
            <input className="input h-9" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Ajouter une étape…" />
            <Button size="sm" variant="secondary"><Plus className="h-4 w-4" /></Button>
          </form>
        </section>

        <section>
          <h3 className="section-title mb-2">Cours, fiches, exercices et documents</h3>
          {l.resources.length === 0 ? (
            <p className="text-sm text-muted">Aucune ressource pour cette séance.</p>
          ) : (
            <ul className="space-y-1.5">
              {l.resources.map((r) => (
                <li key={r.id} className="flex items-start gap-2 rounded-xl bg-surface-2/60 p-2.5 text-sm">
                  {r.url ? <Link2 className="mt-0.5 h-4 w-4 text-primary" /> : <FileText className="mt-0.5 h-4 w-4 text-lavender" />}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink">
                      {r.title} <span className="text-xs font-normal text-muted">· {RES_TYPES[r.type]}</span>
                    </div>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-xs text-primary-strong underline">
                        {r.url} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {r.content && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-2">{r.content}</p>}
                  </div>
                  <button onClick={async () => { await api(`/api/resources/${r.id}`, { method: "DELETE" }); mutate(); }} className="text-muted hover:text-danger" aria-label="Supprimer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 grid gap-2 rounded-2xl border border-dashed border-line p-3 sm:grid-cols-4">
            <select className="input h-9 py-1" value={res.type} onChange={(e) => setRes({ ...res, type: e.target.value })}>
              {Object.entries(RES_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="input h-9 sm:col-span-3" placeholder="Titre" value={res.title} onChange={(e) => setRes({ ...res, title: e.target.value })} />
            <input className="input h-9 sm:col-span-4" placeholder="Lien (Google Drive, PDF…) — facultatif" value={res.url} onChange={(e) => setRes({ ...res, url: e.target.value })} />
            <textarea className="input min-h-[50px] sm:col-span-4" placeholder="Contenu / notes (facultatif)" value={res.content} onChange={(e) => setRes({ ...res, content: e.target.value })} />
            <div className="sm:col-span-4 flex justify-end">
              <Button size="sm" variant="secondary" onClick={addResource}><BookOpen className="h-4 w-4" /> Ajouter la ressource</Button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="section-title">{isPast ? "Bilan de la séance" : "Après la séance"}</h3>
          <Field label="Remarques (progrès, difficultés…)">
            <textarea className="input min-h-[70px]" value={remarks ?? ""} onChange={(e) => setRemarks(e.target.value)} />
          </Field>
          <Field label="Révisions futures / prochaines étapes">
            <textarea className="input min-h-[60px]" value={nextSteps ?? ""} onChange={(e) => setNextSteps(e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex items-end gap-2">
              <Field label="Planifier une révision le">
                <input type="date" className="input h-9" value={revisionDate} onChange={(e) => setRevisionDate(e.target.value)} />
              </Field>
              <Button size="sm" variant="secondary" onClick={planRevision}><CalendarPlus className="h-4 w-4" /> Planifier</Button>
            </div>
            <Button size="sm" variant="soft" onClick={() => patch({ remarks, nextSteps }, "Remarques enregistrées")}>Enregistrer les remarques</Button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function StudentDetail({ id, onClose, onEdit, onNewLesson, onOpenLesson }: { id: string; onClose: () => void; onEdit: (s: Student) => void; onNewLesson: () => void; onOpenLesson: (id: string) => void }) {
  const { confirm, toast } = useUi();
  const { data: s } = useApi<Student & { lessons: Lesson[]; resources: Resource[] }>(`/api/students/${id}`);
  if (!s) return <Modal open onClose={onClose} title="Élève"><Loading /></Modal>;
  const done = s.lessons.filter((l) => l.status === "DONE");
  const upcoming = s.lessons.filter((l) => l.status === "PLANNED" && l.date >= today()).reverse();
  async function del() {
    if (!(await confirm({ title: `Supprimer ${s!.name} ?`, message: "Toutes ses séances, préparations et ressources seront supprimées. Pour garder l'historique, préfère « Archiver ».", danger: true, confirmLabel: "Supprimer définitivement" }))) return;
    await api(`/api/students/${id}`, { method: "DELETE" });
    await refreshAll();
    toast("Élève supprimé·e");
    onClose();
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={s.name}
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-danger" onClick={del}><Trash2 className="h-4 w-4" /> Supprimer</Button>
          <Button variant="secondary" onClick={() => onEdit(s)}><Pencil className="h-4 w-4" /> Modifier</Button>
          <Button onClick={onNewLesson}><Plus className="h-4 w-4" /> Séance</Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div><span className="text-muted">Niveau :</span> {s.level ?? "—"}</div>
          <div><span className="text-muted">Matières :</span> {s.subjects ?? "—"}</div>
        </div>
        {s.goals && <Notice>🎯 {s.goals}</Notice>}
        {s.notes && <p className="whitespace-pre-wrap text-ink-2">{s.notes}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-success-soft p-3 text-center"><div className="text-2xl font-semibold text-success">{done.length}</div><div className="text-xs text-ink-2">séances réalisées</div></div>
          <div className="rounded-2xl bg-primary-soft p-3 text-center"><div className="text-2xl font-semibold text-primary-strong">{upcoming.length}</div><div className="text-xs text-ink-2">séances à venir</div></div>
        </div>
        <div>
          <h3 className="section-title mb-2">Historique</h3>
          {s.lessons.length === 0 ? (
            <p className="text-muted">Aucune séance.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {s.lessons.map((l) => (
                <li key={l.id}>
                  <button onClick={() => onOpenLesson(l.id)} className="flex w-full items-center justify-between gap-2 py-2 text-left">
                    <span className="min-w-0 truncate text-ink">{fmtDayNum(l.date)} · {l.subject}{l.chapter ? ` — ${l.chapter}` : ""}</span>
                    <Badge tone={l.status === "DONE" ? "success" : l.status === "CANCELLED" ? "neutral" : "primary"}>{l.status === "DONE" ? "Réalisée" : l.status === "CANCELLED" ? "Annulée" : "À venir"}</Badge>
                  </button>
                  {l.remarks && <p className="pb-2 text-xs text-muted">💬 {l.remarks}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
