"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, CalendarPlus, Check, ClipboardCheck, ExternalLink, FileText, GraduationCap, Link2, ListChecks, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorBox, Field, Loading, Modal, Notice, PageHeader, Progress, Segmented, useUi } from "@/components/ui";
import { ApiError, api, cx, fmtDateLong, fmtDayNum, refreshAll, relativeDay, useApi } from "@/lib/client";
import { addDays, addMinutesToTime, formatDuration, formatTime, timeToMin, today } from "@/lib/dates";
import { COLOR_PALETTE } from "@/lib/constants";
import type { Readiness } from "@/server/lessons";

type DetailTab = "prep" | "after" | "edit";
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
  const [lesson, setLesson] = useState<{ id: string; tab?: DetailTab } | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("new") === "lesson") setLessonForm({});
    if (params.get("lesson")) setLesson({ id: params.get("lesson")! });
    if (params.get("new") || params.get("lesson")) router.replace("/cours");
  }, [params, router]);

  const upcoming = useApi<Lesson[]>("/api/lessons?scope=upcoming");
  const past = useApi<Lesson[]>("/api/lessons?scope=past");
  const students = useApi<Student[]>("/api/students");
  const t = today();

  const activeStudents = (students.data ?? []).filter((s) => !s.archived);
  const toComplete = (past.data ?? []).filter((l) => l.status === "PLANNED");
  const next = upcoming.data?.[0];
  const weekEnd = addDays(t, 6);
  const thisWeek = (upcoming.data ?? []).filter((l) => l.date <= weekEnd);
  const later = (upcoming.data ?? []).filter((l) => l.date > weekEnd);
  const loading = !students.data || !upcoming.data;
  const step = activeStudents.length === 0 ? 1 : (upcoming.data?.length ?? 0) === 0 ? 2 : 3;

  return (
    <div>
      <PageHeader
        title="Mes cours particuliers"
        subtitle="Ajoute tes élèves, planifie tes séances : l'application réserve le temps de préparation pour toi."
        actions={
          <>
            <Button variant="secondary" onClick={() => setStudentForm({})}>
              <UserPlus className="h-4 w-4" /> Ajouter un élève
            </Button>
            <Button onClick={() => setLessonForm({})}>
              <CalendarPlus className="h-4 w-4" /> Planifier une séance
            </Button>
          </>
        }
      />

      {loading ? (
        <Loading />
      ) : (
        <>
          {step < 3 && <Guide step={step} onStudent={() => setStudentForm({})} onLesson={() => setLessonForm({})} />}

          {toComplete.length > 0 && (
            <Card title="Séances passées à compléter" icon={<ClipboardCheck className="h-4 w-4" />} className="mb-5 border-warning/40">
              <p className="mb-3 text-sm text-ink-2">Dis-moi comment elles se sont passées (1 clic), et ajoute une remarque si tu veux.</p>
              <ul className="space-y-2">
                {toComplete.slice(0, 5).map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/60 p-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.student.color }} />
                    <span className="min-w-0 flex-1 text-sm text-ink">
                      <strong>{l.student.name}</strong> · {l.subject} · <span className="first-letter:uppercase">{relativeDay(l.date, t)}</span> {formatTime(l.startTime)}
                    </span>
                    <Button size="sm" variant="success" onClick={() => setLesson({ id: l.id, tab: "after" })}>
                      <Check className="h-3.5 w-3.5" /> Elle a eu lieu
                    </Button>
                    <QuickCancel id={l.id} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Segmented
            className="mb-4"
            value={tab}
            onChange={setTab}
            options={[
              { value: "upcoming", label: `À venir (${upcoming.data!.length})` },
              { value: "students", label: `Mes élèves (${activeStudents.length})` },
              { value: "past", label: "Historique" },
            ]}
          />

          {tab === "upcoming" &&
            (upcoming.error ? (
              <ErrorBox error={upcoming.error} />
            ) : !next ? (
              <Empty icon={<GraduationCap className="h-8 w-8" />} title="Aucune séance à venir" action={activeStudents.length ? <Button size="sm" onClick={() => setLessonForm({})}>Planifier une séance</Button> : <Button size="sm" onClick={() => setStudentForm({})}>Ajouter un élève</Button>} />
            ) : (
              <div className="space-y-5">
                <NextLesson l={next} onPrepare={() => setLesson({ id: next.id, tab: "prep" })} onOpen={() => setLesson({ id: next.id })} />
                {thisWeek.length > 1 && (
                  <LessonList title="Cette semaine" lessons={thisWeek.slice(1)} onOpen={(id) => setLesson({ id })} />
                )}
                {later.length > 0 && <LessonList title="Plus tard" lessons={thisWeek.length === 0 ? later.slice(1) : later} onOpen={(id) => setLesson({ id })} />}
              </div>
            ))}

          {tab === "students" &&
            (activeStudents.length === 0 && !(students.data ?? []).length ? (
              <Empty icon={<Users className="h-8 w-8" />} title="Aucun élève pour l'instant" action={<Button size="sm" onClick={() => setStudentForm({})}>Ajouter un élève</Button>}>
                Il suffit d&apos;un prénom. Le niveau et les matières sont facultatifs.
              </Empty>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(students.data ?? []).map((s) => (
                  <div key={s.id} className={cx("card flex flex-col p-4", s.archived && "opacity-60")}>
                    <button onClick={() => setStudentId(s.id)} className="flex items-center gap-3 text-left">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl font-display text-lg font-semibold text-white" style={{ background: s.color }}>
                        {s.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">{s.name}</div>
                        <div className="truncate text-xs text-muted">
                          {[s.level, s.subjects].filter(Boolean).join(" · ") || "Niveau et matières non précisés"}
                        </div>
                      </div>
                    </button>
                    {s.goals && <p className="mt-3 line-clamp-2 text-xs text-ink-2">🎯 {s.goals}</p>}
                    <p className="mt-3 text-xs text-muted">
                      {s.nextLesson ? (
                        <>
                          Prochaine séance : <span className="font-medium text-ink-2">{relativeDay(s.nextLesson.date, t)} à {formatTime(s.nextLesson.startTime)}</span>
                        </>
                      ) : (
                        "Aucune séance prévue"
                      )}{" "}
                      · {s.lessonsDone} réalisée(s)
                    </p>
                    {!s.archived && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => setLessonForm({ studentId: s.id })}>
                          <CalendarPlus className="h-3.5 w-3.5" /> Planifier
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setStudentId(s.id)}>
                          Voir la fiche
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

          {tab === "past" &&
            ((past.data ?? []).length === 0 ? (
              <Empty title="Aucune séance passée pour l'instant" />
            ) : (
              <Card>
                <ul className="divide-y divide-line/60">
                  {past.data!.map((l) => (
                    <li key={l.id}>
                      <button onClick={() => setLesson({ id: l.id, tab: "after" })} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-ink">
                            {l.student.name} — {l.subject}
                            {l.chapter ? ` · ${l.chapter}` : ""}
                          </div>
                          <div className="truncate text-xs text-muted">{l.remarks ? `💬 ${l.remarks}` : "Pas encore de remarque"}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-muted">{fmtDayNum(l.date)}</span>
                          <Badge tone={l.status === "DONE" ? "success" : l.status === "CANCELLED" ? "neutral" : "warning"}>
                            {l.status === "DONE" ? "Réalisée" : l.status === "CANCELLED" ? "Annulée" : "À compléter"}
                          </Badge>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
        </>
      )}

      {lessonForm && <LessonForm open studentId={lessonForm.studentId} students={students.data ?? []} onClose={() => setLessonForm(null)} />}
      {studentForm && <StudentForm open initial={studentForm} onClose={() => setStudentForm(null)} />}
      {lesson && <LessonDetail id={lesson.id} initialTab={lesson.tab} onClose={() => setLesson(null)} />}
      {studentId && (
        <StudentDetail
          id={studentId}
          onClose={() => setStudentId(null)}
          onEdit={(s) => { setStudentId(null); setStudentForm(s); }}
          onNewLesson={() => { const id = studentId; setStudentId(null); setLessonForm({ studentId: id }); }}
          onOpenLesson={(id) => { setStudentId(null); setLesson({ id }); }}
        />
      )}
    </div>
  );
}

/** Mode d'emploi en 3 étapes, affiché tant que tout n'est pas en place. */
function Guide({ step, onStudent, onLesson }: { step: number; onStudent: () => void; onLesson: () => void }) {
  const steps = [
    { n: 1, title: "Ajoute ton élève", text: "Un prénom suffit. Tu peux ajouter le niveau et les matières.", action: <Button size="sm" onClick={onStudent}><UserPlus className="h-3.5 w-3.5" /> Ajouter un élève</Button> },
    { n: 2, title: "Planifie une séance", text: "Choisis le jour, l'heure et la matière. Tu peux la répéter chaque semaine.", action: <Button size="sm" onClick={onLesson}><CalendarPlus className="h-3.5 w-3.5" /> Planifier</Button> },
    { n: 3, title: "Prépare-la", text: "Le temps de préparation est réservé la veille, avec une checklist à cocher.", action: null },
  ];
  return (
    <div className="card mb-5 p-4 sm:p-5">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">Comment ça marche ?</h2>
      <p className="mb-4 text-sm text-muted">Trois étapes, et tout s&apos;organise ensuite tout seul dans ton planning.</p>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((s) => {
          const done = s.n < step;
          const current = s.n === step;
          return (
            <li key={s.n} className={cx("rounded-2xl border p-4", current ? "border-primary bg-primary-soft/50" : "border-line", done && "opacity-70")}>
              <div className="mb-2 flex items-center gap-2">
                <span className={cx("flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", done ? "bg-success text-white" : current ? "bg-primary-strong text-white dark:text-[#0e1322]" : "bg-surface-2 text-muted")}>
                  {done ? <Check className="h-4 w-4" /> : s.n}
                </span>
                <span className="font-medium text-ink">{s.title}</span>
              </div>
              <p className="text-xs text-ink-2">{s.text}</p>
              {current && s.action && <div className="mt-3">{s.action}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function prepSentence(l: Lesson) {
  const total = l.prepItems.length;
  const done = l.prepItems.filter((i) => i.done).length;
  if (l.prepMinutes === 0 && total === 0) return { tone: "neutral" as const, text: "Pas de préparation prévue" };
  if (l.readiness.state === "ready") return { tone: "success" as const, text: "Préparation terminée ✓" };
  if (l.readiness.state === "at_risk") return { tone: "warning" as const, text: `À préparer vite (${done}/${total} étapes)` };
  return { tone: "primary" as const, text: `À préparer (${done}/${total} étapes)` };
}

function NextLesson({ l, onPrepare, onOpen }: { l: Lesson; onPrepare: () => void; onOpen: () => void }) {
  const p = prepSentence(l);
  const prepAct = l.activities.find((a) => a.lessonRole === "prep");
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-display text-2xl font-semibold text-white" style={{ background: l.student.color }}>
          {l.student.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Prochaine séance</div>
          <div className="font-display text-xl font-semibold text-ink">
            <span className="first-letter:uppercase inline-block">{relativeDay(l.date, today())}</span> à {formatTime(l.startTime)} — {l.student.name}
          </div>
          <div className="text-sm text-ink-2">
            {l.subject}
            {l.chapter ? ` · ${l.chapter}` : ""} · {formatDuration(timeToMin(l.endTime) - timeToMin(l.startTime))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onOpen}>
            Détails
          </Button>
          {l.readiness.state !== "ready" && (l.prepItems.length > 0) && (
            <Button onClick={onPrepare}>
              <ListChecks className="h-4 w-4" /> Préparer maintenant
            </Button>
          )}
        </div>
      </div>
      <div className="border-t border-line/60 bg-surface-2/40 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={p.tone}>{p.text}</Badge>
          {l.prepItems.length > 0 && <Progress value={l.readiness.progress} tone={p.tone === "warning" ? "warning" : "success"} className="max-w-xs flex-1" />}
          <span className="text-xs text-muted">
            {prepAct?.startTime
              ? `Temps de préparation réservé : ${relativeDay(prepAct.date, today()).toLowerCase()} à ${formatTime(prepAct.startTime)}`
              : prepAct
                ? "Préparation à placer dans ta journée (aucun créneau libre trouvé)"
                : ""}
          </span>
        </div>
        {l.readiness.state === "at_risk" && <p className="mt-2 text-xs text-warning">⚠ {l.readiness.message}</p>}
      </div>
    </div>
  );
}

function LessonList({ title, lessons, onOpen }: { title: string; lessons: Lesson[]; onOpen: (id: string) => void }) {
  const t = today();
  const [all, setAll] = useState(false);
  const shown = all ? lessons : lessons.slice(0, 5);
  return (
    <Card
      title={`${title} (${lessons.length})`}
      action={
        lessons.length > 5 ? (
          <button className="text-xs font-medium text-primary-strong" onClick={() => setAll(!all)}>
            {all ? "Réduire" : "Voir tout"}
          </button>
        ) : undefined
      }
    >
      <ul className="divide-y divide-line/60">
        {shown.map((l) => {
          const p = prepSentence(l);
          return (
            <li key={l.id}>
              <button onClick={() => onOpen(l.id)} className="flex w-full flex-wrap items-center gap-3 py-3 text-left">
                <div className="w-24 shrink-0 text-sm">
                  <div className="font-medium text-ink first-letter:uppercase">{relativeDay(l.date, t)}</div>
                  <div className="text-xs text-muted">{formatTime(l.startTime)}</div>
                </div>
                <span className="h-8 w-1 rounded-full" style={{ background: l.student.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{l.student.name}</div>
                  <div className="truncate text-xs text-muted">
                    {l.subject}
                    {l.chapter ? ` · ${l.chapter}` : ""}
                  </div>
                </div>
                <Badge tone={p.tone}>{p.text}</Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function QuickCancel({ id }: { id: string }) {
  const { toast } = useUi();
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        await api(`/api/lessons/${id}`, { method: "PATCH", body: { status: "CANCELLED" } });
        await refreshAll();
        toast("Séance marquée comme annulée");
      }}
    >
      Annulée
    </Button>
  );
}

function ReadinessBadge({ r }: { r: Readiness }) {
  if (r.state === "ready") return <Badge tone="success">Prête ✓</Badge>;
  if (r.state === "at_risk") return <Badge tone="warning">À préparer vite</Badge>;
  if (r.state === "past") return <Badge>Passée</Badge>;
  return <Badge tone="primary">À préparer</Badge>;
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs text-primary-strong">{n}</span>
        {title}
      </h3>
      <div className="pl-8">{children}</div>
    </section>
  );
}

const chip = (on: boolean) =>
  cx("rounded-full border px-3 py-1.5 text-xs font-medium transition", on ? "border-primary bg-primary text-white dark:text-[#0e1322]" : "border-line bg-surface text-ink-2 hover:border-primary/50");

const DURATIONS = [45, 60, 90, 120];
const PREP_OPTIONS = [0, 30, 45, 60, 90];

function LessonForm({ open, onClose, students, studentId }: { open: boolean; onClose: () => void; students: Student[]; studentId?: string }) {
  const { toast } = useUi();
  const active = students.filter((s) => !s.archived);
  const [newStudent, setNewStudent] = useState(active.length === 0);
  const [ns, setNs] = useState({ name: "", level: "", subjects: "" });
  const [f, setF] = useState({
    studentId: studentId ?? active[0]?.id ?? "",
    date: addDays(today(), 1),
    startTime: "16:00",
    duration: 60,
    subject: "",
    chapter: "",
    prepMinutes: 60,
    prepDate: "",
    weekly: false,
    weeks: 8,
  });
  const [showPrepDay, setShowPrepDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const student = students.find((s) => s.id === f.studentId);
  const subjects = (newStudent ? ns.subjects : student?.subjects ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const endTime = addMinutesToTime(f.startTime || "16:00", f.duration);

  useEffect(() => {
    if (!f.studentId && active.length && !newStudent) setF((x) => ({ ...x, studentId: active[0].id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length]);

  useEffect(() => {
    if (!newStudent && student?.subjects) setF((x) => ({ ...x, subject: student.subjects!.split(",")[0].trim() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.studentId, newStudent]);

  const quickDays = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(today(), n));
  const who = newStudent ? ns.name.trim() || "ton nouvel élève" : student?.name ?? "—";

  async function save(allowConflict = false) {
    setErr(null);
    if (newStudent && !ns.name.trim()) return setErr("Écris le prénom de l'élève.");
    if (!newStudent && !f.studentId) return setErr("Choisis un élève.");
    if (!f.subject.trim()) return setErr("Indique la matière (ex. Mathématiques).");
    if (!f.startTime) return setErr("Indique l'heure de début.");
    if (timeToMin(f.startTime) + f.duration > 24 * 60) return setErr("La séance doit se terminer avant minuit.");
    setSaving(true);
    try {
      let sid = f.studentId;
      if (newStudent) {
        const s = await api<{ id: string }>("/api/students", {
          body: { name: ns.name.trim(), level: ns.level || null, subjects: ns.subjects || f.subject, color: COLOR_PALETTE[students.length % COLOR_PALETTE.length] },
        });
        sid = s.id;
        setF((x) => ({ ...x, studentId: s.id }));
        setNewStudent(false);
      }
      const r = await api<{ prepPlaced: { date: string; startTime: string } | null }>("/api/lessons", {
        body: {
          studentId: sid,
          date: f.date,
          startTime: f.startTime,
          endTime,
          subject: f.subject.trim(),
          chapter: f.chapter || null,
          prepMinutes: f.prepMinutes,
          prepDate: f.prepDate || null,
          recurrenceWeeks: f.weekly ? Math.max(0, f.weeks - 1) : 0,
          allowConflict,
        },
      });
      await refreshAll();
      toast(
        f.prepMinutes > 0
          ? r.prepPlaced
            ? `Séance planifiée ✨ Préparation réservée ${relativeDay(r.prepPlaced.date, today()).toLowerCase()} à ${formatTime(r.prepPlaced.startTime)}.`
            : "Séance planifiée. Pas de créneau libre pour la préparation : elle est dans ta liste du jour, sans horaire."
          : "Séance planifiée ✨",
        r.prepPlaced || !f.prepMinutes ? "success" : "warning",
      );
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const c = e.data as { conflicts: { title: string; date: string; startTime: string }[]; suggestion: { date: string; startTime: string } | null };
        setConflict(
          `Tu as déjà ${c.conflicts.map((x) => `« ${x.title} » (${fmtDayNum(x.date)} à ${formatTime(x.startTime)})`).join(", ")} sur ce créneau.${c.suggestion ? ` Créneau libre proposé : ${fmtDayNum(c.suggestion.date)} à ${formatTime(c.suggestion.startTime)}.` : ""}`,
        );
      } else setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Planifier une séance"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          {conflict && (
            <Button variant="secondary" onClick={() => save(true)}>
              Planifier quand même
            </Button>
          )}
          <Button onClick={() => save(false)} loading={saving}>
            <Check className="h-4 w-4" /> Planifier la séance
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {err && <Notice tone="danger">{err}</Notice>}

        <Section n={1} title="Avec quel élève ?">
          <div className="flex flex-wrap gap-2">
            {active.map((s) => (
              <button key={s.id} type="button" onClick={() => { setNewStudent(false); setF({ ...f, studentId: s.id, subject: "" }); }} className={chip(!newStudent && f.studentId === s.id)}>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: s.color }} />
                {s.name}
              </button>
            ))}
            <button type="button" onClick={() => setNewStudent(true)} className={chip(newStudent)}>
              <Plus className="mr-1 inline h-3 w-3" /> Nouvel élève
            </button>
          </div>
          {newStudent && (
            <div className="mt-3 grid gap-2 rounded-2xl bg-surface-2/60 p-3 sm:grid-cols-3">
              <Field label="Prénom *">
                <input className="input" value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} placeholder="Lina" autoFocus />
              </Field>
              <Field label="Niveau (facultatif)">
                <input className="input" value={ns.level} onChange={(e) => setNs({ ...ns, level: e.target.value })} placeholder="3e, Terminale…" />
              </Field>
              <Field label="Matières (facultatif)">
                <input className="input" value={ns.subjects} onChange={(e) => setNs({ ...ns, subjects: e.target.value })} placeholder="Maths, Physique" />
              </Field>
            </div>
          )}
        </Section>

        <Section n={2} title="Quel jour et à quelle heure ?">
          <div className="no-scrollbar -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1">
            {quickDays.map((d) => (
              <button key={d} type="button" onClick={() => setF({ ...f, date: d })} className={cx(chip(f.date === d), "shrink-0 first-letter:uppercase")}>
                {relativeDay(d, today())}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Date">
              <input type="date" className="input" value={f.date} onChange={(e) => e.target.value && setF({ ...f, date: e.target.value })} />
            </Field>
            <Field label="Heure de début">
              <input type="time" className="input" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
            </Field>
            <div className="col-span-2 sm:col-span-1">
              <span className="label">Durée</span>
              <div className="flex flex-wrap gap-1.5">
                {DURATIONS.map((d) => (
                  <button key={d} type="button" onClick={() => setF({ ...f, duration: d })} className={chip(f.duration === d)}>
                    {formatDuration(d)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={f.weekly} onChange={(e) => setF({ ...f, weekly: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--primary))]" />
            Répéter chaque semaine, le même jour à la même heure
          </label>
          {f.weekly && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
              Pendant
              {[4, 8, 12, 20, 30].map((w) => (
                <button key={w} type="button" onClick={() => setF({ ...f, weeks: w })} className={chip(f.weeks === w)}>
                  {w} semaines
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section n={3} title="Quelle matière ?">
          {subjects.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {subjects.map((s) => (
                <button key={s} type="button" onClick={() => setF({ ...f, subject: s })} className={chip(f.subject === s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Matière *">
              <input className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="Mathématiques" />
            </Field>
            <Field label="Chapitre (facultatif)">
              <input className="input" value={f.chapter} onChange={(e) => setF({ ...f, chapter: e.target.value })} placeholder="Théorème de Pythagore" />
            </Field>
          </div>
        </Section>

        <Section n={4} title="Combien de temps pour la préparer ?">
          <div className="flex flex-wrap gap-1.5">
            {PREP_OPTIONS.map((m) => (
              <button key={m} type="button" onClick={() => setF({ ...f, prepMinutes: m })} className={chip(f.prepMinutes === m)}>
                {m === 0 ? "Pas besoin" : formatDuration(m)}
              </button>
            ))}
          </div>
          {f.prepMinutes > 0 && (
            <p className="mt-2 text-xs text-muted">
              Je réserve ce temps <strong>la veille</strong> dans un créneau libre.{" "}
              <button type="button" className="text-primary-strong underline" onClick={() => setShowPrepDay(!showPrepDay)}>
                Choisir un autre jour
              </button>
            </p>
          )}
          {showPrepDay && f.prepMinutes > 0 && (
            <input type="date" className="input mt-2 w-48" value={f.prepDate} max={f.date} onChange={(e) => setF({ ...f, prepDate: e.target.value })} aria-label="Jour de préparation" />
          )}
        </Section>

        {conflict && <Notice tone="warning">{conflict}</Notice>}

        <div className="rounded-2xl bg-lavender-soft/60 p-4 text-sm text-ink">
          <p className="mb-1 font-semibold">Ce qui va se passer :</p>
          <ul className="space-y-1 text-ink-2">
            <li>
              📅 Séance avec <strong>{who}</strong>, <span>{relativeDay(f.date, today()).toLowerCase()}</span> de {formatTime(f.startTime)} à {formatTime(endTime)}
              {f.subject ? ` (${f.subject})` : ""}.
            </li>
            {f.weekly && <li>🔁 Répétée chaque semaine pendant {f.weeks} semaines.</li>}
            {f.prepMinutes > 0 && <li>📝 {formatDuration(f.prepMinutes)} de préparation réservée avant, avec une checklist de 6 étapes à cocher.</li>}
            <li>🔔 Un rappel avant la séance, et tout apparaît dans ton planning.</li>
          </ul>
        </div>
      </div>
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

function LessonDetail({ id, onClose, initialTab }: { id: string; onClose: () => void; initialTab?: DetailTab }) {
  const { toast, confirm } = useUi();
  const { data: l, mutate } = useApi<Lesson>(`/api/lessons/${id}`);
  const [newItem, setNewItem] = useState("");
  const [remarks, setRemarks] = useState<string | null>(null);
  const [nextSteps, setNextSteps] = useState<string | null>(null);
  const [res, setRes] = useState({ type: "FICHE", title: "", url: "", content: "" });
  const [revisionDate, setRevisionDate] = useState(addDays(today(), 14));
  const [dtab, setDtab] = useState<DetailTab>(initialTab ?? "prep");
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
  const done = l.prepItems.filter((i) => i.done).length;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: l.student.color }} />
          {l.student.name} — {l.subject}
        </span>
      }
      footer={
        dtab === "edit" ? (
          <>
            <Button variant="ghost" className="mr-auto text-danger" onClick={del}>
              <Trash2 className="h-4 w-4" /> Supprimer la séance
            </Button>
            <Button onClick={() => patch({ ...ef, chapter: ef.chapter || null }, "Séance modifiée")}>Enregistrer les modifications</Button>
          </>
        ) : dtab === "after" ? (
          <>
            {l.status === "DONE" ? (
              <Button variant="secondary" onClick={() => patch({ status: "PLANNED" }, "Séance remise « à venir »")}>
                Remettre à venir
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => patch({ status: "CANCELLED", remarks, nextSteps }, "Séance marquée comme annulée")}>
                Elle n&apos;a pas eu lieu
              </Button>
            )}
            <Button variant="success" onClick={() => patch({ status: "DONE", remarks, nextSteps }, "Séance enregistrée 🎓")}>
              <Check className="h-4 w-4" /> {l.status === "DONE" ? "Enregistrer" : "Séance faite, enregistrer"}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-2/60 px-4 py-3">
          <div className="text-sm text-ink">
            <span className="font-medium first-letter:uppercase inline-block">{fmtDateLong(l.date)}</span> · {formatTime(l.startTime)} – {formatTime(l.endTime)}
            {l.chapter && <div className="text-xs text-muted">Chapitre : {l.chapter}</div>}
          </div>
          <ReadinessBadge r={l.readiness} />
        </div>

        <Segmented
          value={dtab}
          onChange={setDtab}
          options={[
            { value: "prep", label: `1. Préparer (${done}/${l.prepItems.length})` },
            { value: "after", label: "2. Après la séance" },
            { value: "edit", label: "Modifier" },
          ]}
        />

        {dtab === "prep" && (
          <div className="space-y-5">
            {l.readiness.state === "at_risk" && <Notice tone="warning">{l.readiness.message}</Notice>}
            <section>
              <p className="mb-2 text-sm text-ink-2">
                Coche chaque étape quand elle est faite.
                {prepAct?.startTime ? ` Temps réservé : ${fmtDayNum(prepAct.date)} à ${formatTime(prepAct.startTime)} (${formatDuration(l.prepMinutes)}).` : ""}
              </p>
              <Progress value={l.readiness.progress} tone="success" className="mb-3" />
              <ul className="space-y-1.5">
                {l.prepItems.map((i) => (
                  <li key={i.id} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2/60">
                    <button
                      onClick={() => toggle(i)}
                      className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition", i.done ? "border-success bg-success text-white" : "border-line hover:border-success")}
                      aria-label={i.label}
                    >
                      {i.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </button>
                    <span className={cx("flex-1 text-sm", i.done ? "text-muted line-through" : "text-ink")}>{i.label}</span>
                    <button
                      onClick={async () => { await api(`/api/lessons/${id}/prep?itemId=${i.id}`, { method: "DELETE" }); mutate(); }}
                      className="text-muted opacity-0 hover:text-danger group-hover:opacity-100"
                      aria-label="Retirer l'étape"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addItem(); }}>
                <input className="input h-9" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Ajouter une étape (ex. Imprimer les exercices)" />
                <Button size="sm" variant="secondary" aria-label="Ajouter l'étape"><Plus className="h-4 w-4" /></Button>
              </form>
            </section>

            <section>
              <h3 className="section-title mb-1">Mes documents pour cette séance</h3>
              <p className="mb-2 text-xs text-muted">Cours, fiches, exercices : colle un lien (Google Drive, PDF…) ou écris directement le contenu.</p>
              {l.resources.length > 0 && (
                <ul className="mb-2 space-y-1.5">
                  {l.resources.map((r) => (
                    <li key={r.id} className="flex items-start gap-2 rounded-xl bg-surface-2/60 p-2.5 text-sm">
                      {r.url ? <Link2 className="mt-0.5 h-4 w-4 text-primary" /> : <FileText className="mt-0.5 h-4 w-4 text-lavender" />}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-ink">
                          {r.title} <span className="text-xs font-normal text-muted">· {RES_TYPES[r.type]}</span>
                        </div>
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-xs text-primary-strong underline">
                            Ouvrir <ExternalLink className="h-3 w-3" />
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
              <div className="grid gap-2 rounded-2xl border border-dashed border-line p-3 sm:grid-cols-4">
                <select className="input h-9 py-1" value={res.type} onChange={(e) => setRes({ ...res, type: e.target.value })} aria-label="Type">
                  {Object.entries(RES_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input className="input h-9 sm:col-span-3" placeholder="Titre (ex. Fiche Pythagore)" value={res.title} onChange={(e) => setRes({ ...res, title: e.target.value })} />
                <input className="input h-9 sm:col-span-4" placeholder="Lien (facultatif)" value={res.url} onChange={(e) => setRes({ ...res, url: e.target.value })} />
                <textarea className="input min-h-[50px] sm:col-span-4" placeholder="Contenu ou notes (facultatif)" value={res.content} onChange={(e) => setRes({ ...res, content: e.target.value })} />
                <div className="sm:col-span-4 flex justify-end">
                  <Button size="sm" variant="secondary" onClick={addResource}><BookOpen className="h-4 w-4" /> Ajouter le document</Button>
                </div>
              </div>
            </section>
          </div>
        )}

        {dtab === "after" && (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">Note en quelques mots comment s&apos;est passée la séance. Ça t&apos;aidera à préparer la suivante.</p>
            <Field label="Comment ça s'est passé ? (progrès, difficultés…)">
              <textarea className="input min-h-[80px]" value={remarks ?? ""} onChange={(e) => setRemarks(e.target.value)} placeholder="Ex. Bonne progression sur les fractions, encore des hésitations sur les priorités." />
            </Field>
            <Field label="À revoir la prochaine fois">
              <textarea className="input min-h-[60px]" value={nextSteps ?? ""} onChange={(e) => setNextSteps(e.target.value)} placeholder="Ex. Refaire 3 exercices sur les priorités opératoires." />
            </Field>
            <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-surface-2/60 p-3">
              <Field label="Prévoir une révision le">
                <input type="date" className="input h-9" value={revisionDate} onChange={(e) => setRevisionDate(e.target.value)} />
              </Field>
              <Button size="sm" variant="secondary" onClick={planRevision}><CalendarPlus className="h-4 w-4" /> Ajouter au planning</Button>
            </div>
          </div>
        )}

        {dtab === "edit" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date"><input type="date" className="input" value={ef.date} onChange={(e) => setEf({ ...ef, date: e.target.value })} /></Field>
            <Field label="Début"><input type="time" className="input" value={ef.startTime} onChange={(e) => setEf({ ...ef, startTime: e.target.value, endTime: addMinutesToTime(e.target.value, timeToMin(ef.endTime) - timeToMin(ef.startTime)) })} /></Field>
            <Field label="Fin"><input type="time" className="input" value={ef.endTime} onChange={(e) => setEf({ ...ef, endTime: e.target.value })} /></Field>
            <Field label="Matière"><input className="input" value={ef.subject} onChange={(e) => setEf({ ...ef, subject: e.target.value })} /></Field>
            <Field label="Chapitre"><input className="input" value={ef.chapter} onChange={(e) => setEf({ ...ef, chapter: e.target.value })} /></Field>
            <Field label="Préparation (min)"><input type="number" min={0} step={15} className="input" value={ef.prepMinutes} onChange={(e) => setEf({ ...ef, prepMinutes: Number(e.target.value) || 0 })} /></Field>
            <p className="text-xs text-muted sm:col-span-3">Le créneau de la séance est mis à jour dans ton planning. Pour l&apos;annuler sans la supprimer, va dans « 2. Après la séance ».</p>
          </div>
        )}
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
