"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, CalendarPlus, Check, ClipboardCheck, ExternalLink, FileText, GraduationCap, Link2, ListChecks, Pencil, Plus, Search, SlidersHorizontal, Trash2, UserPlus, Users, X } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorBox, Field, Loading, Modal, Notice, PageHeader, Progress, Segmented, useUi } from "@/components/ui";
import { ApiError, api, cx, fmtDateLong, fmtDayNum, refreshAll, relativeDay, useApi } from "@/lib/client";
import { addDays, addMinutesToTime, formatDuration, formatTime, startOfWeek, timeToMin, today } from "@/lib/dates";
import { COLOR_PALETTE } from "@/lib/constants";
import type { Readiness } from "@/server/lessons";
import { NameTag, textOn } from "@/components/NameTag";
import { PaymentsView, rateLabel, useMoney } from "@/components/Payments";
import { BILLING_LABELS, type BillingMode } from "@/lib/billing";

type DetailTab = "prep" | "after" | "edit";
type PrepItem = { id: string; label: string; done: boolean; order: number };
type Resource = { id: string; type: string; title: string; url: string | null; content: string | null };
type Person = { id: string; name: string; color: string };
type Student = {
  id: string;
  name: string;
  level: string | null;
  subjects: string | null;
  goals: string | null;
  notes: string | null;
  color: string;
  archived: boolean;
  isGroup: boolean;
  members: Person[];
  groups: Person[];
  billingMode: BillingMode;
  rate: number | null;
  lessonsDone: number;
  nextLesson: { date: string; startTime: string; subject: string } | null;
};
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
  price: number | null;
  incomeId: string | null;
  student: { id: string; name: string; color: string; level: string | null; isGroup?: boolean; members?: Person[] };
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
  const [tab, setTab] = useState<"upcoming" | "students" | "past" | "payments">("upcoming");
  const [view, setView] = useState<"table" | "week">("table");
  const [fl, setFl] = useStoredFilters();
  const [sq, setSq] = useState("");
  const [showArchived, setShowArchived] = useState(false);
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

  const all = students.data ?? [];
  const activeStudents = all.filter((s) => !s.archived && !s.isGroup);
  const groups = all.filter((s) => s.isGroup);
  const toComplete = (past.data ?? []).filter((l) => l.status === "PLANNED");
  const next = upcoming.data?.[0];
  const loading = !students.data || !upcoming.data;
  const step = activeStudents.length === 0 ? 1 : (upcoming.data?.length ?? 0) === 0 ? 2 : 3;
  const filterable = all.filter((s) => !s.archived);
  const subjectsList = [...new Set([...(upcoming.data ?? []), ...(past.data ?? [])].map((l) => l.subject.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const upcomingFiltered = applyFilters(upcoming.data ?? [], fl, "upcoming");
  const pastFiltered = applyFilters(past.data ?? [], fl, "past");
  const activeCount = countActive(fl, tab === "past" ? "past" : "upcoming");
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const studentMatch = (st: Student) =>
    (showArchived || !st.archived) &&
    (!sq.trim() || norm(`${st.name} ${st.level ?? ""} ${st.subjects ?? ""} ${st.members.map((m) => m.name).join(" ")}`).includes(norm(sq.trim())));

  return (
    <div>
      <PageHeader
        title="Mes cours particuliers"
        subtitle="Ajoute tes élèves et tes groupes, planifie tes séances : l'application réserve le temps de préparation pour toi."
        actions={
          <>
            <Button variant="secondary" onClick={() => setStudentForm({})}>
              <UserPlus className="h-4 w-4" /> Élève
            </Button>
            <Button variant="secondary" onClick={() => setStudentForm({ isGroup: true })}>
              <Users className="h-4 w-4" /> Groupe
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
                    <NameTag name={l.student.name} color={l.student.color} group={l.student.isGroup} />
                    <span className="min-w-0 flex-1 text-sm text-ink">
                      {l.subject} · <span className="inline-block first-letter:uppercase">{relativeDay(l.date, t)}</span> {formatTime(l.startTime)}
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
              { value: "students", label: `Élèves et groupes (${activeStudents.length + groups.length})` },
              { value: "past", label: "Historique" },
              { value: "payments", label: "💶 Paiements" },
            ]}
          />

          {tab === "payments" && <PaymentsView onEditStudent={(id) => { const st = all.find((x) => x.id === id); if (st) setStudentForm(st); }} />}

          {(tab === "upcoming" || tab === "past") && (upcoming.data!.length > 0 || (past.data ?? []).length > 0) && (
            <FilterBar
              value={fl}
              onChange={setFl}
              people={filterable}
              subjects={subjectsList}
              mode={tab === "past" ? "past" : "upcoming"}
              resultCount={tab === "past" ? pastFiltered.length : upcomingFiltered.length}
              activeCount={activeCount}
            />
          )}

          {tab === "upcoming" &&
            (upcoming.error ? (
              <ErrorBox error={upcoming.error} />
            ) : !next ? (
              <Empty
                icon={<GraduationCap className="h-8 w-8" />}
                title="Aucune séance à venir"
                action={activeStudents.length ? <Button size="sm" onClick={() => setLessonForm({})}>Planifier une séance</Button> : <Button size="sm" onClick={() => setStudentForm({})}>Ajouter un élève</Button>}
              />
            ) : (
              <div className="space-y-5">
                {activeCount === 0 && <NextLesson l={next} onPrepare={() => setLesson({ id: next.id, tab: "prep" })} onOpen={() => setLesson({ id: next.id })} />}
                <Card
                  title="Mes séances"
                  action={
                    <Segmented
                      value={view}
                      onChange={setView}
                      options={[
                        { value: "table", label: "Tableau" },
                        { value: "week", label: "Semaine" },
                      ]}
                    />
                  }
                >
                  {upcomingFiltered.length === 0 ? (
                    <Empty title="Aucune séance ne correspond aux filtres" action={<Button size="sm" variant="secondary" onClick={() => setFl(DEFAULT_FILTERS)}>Effacer les filtres</Button>} />
                  ) : view === "table" ? (
                    <LessonTable lessons={upcomingFiltered} onOpen={(id, tb) => setLesson({ id, tab: tb })} />
                  ) : (
                    <WeekGrid lessons={upcomingFiltered} onOpen={(id) => setLesson({ id })} />
                  )}
                </Card>
              </div>
            ))}

          {tab === "students" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[14rem] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input className="input pl-9" placeholder="Rechercher un élève, un niveau, une matière…" value={sq} onChange={(e) => setSq(e.target.value)} aria-label="Rechercher un élève" />
                </div>
                <label className="flex items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--primary))]" /> Afficher les archivés
                </label>
              </div>
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="section-title">Mes élèves ({activeStudents.length})</h2>
                  <Button size="sm" variant="secondary" onClick={() => setStudentForm({})}>
                    <UserPlus className="h-3.5 w-3.5" /> Ajouter un élève
                  </Button>
                </div>
                {all.filter((s) => !s.isGroup && studentMatch(s)).length === 0 ? (
                  <Empty icon={<Users className="h-8 w-8" />} title={sq ? "Aucun élève ne correspond à ta recherche" : "Aucun élève pour l'instant"}>
                    {sq ? "" : "Il suffit d'un prénom. Le niveau et les matières sont facultatifs."}
                  </Empty>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {all.filter((s) => !s.isGroup && studentMatch(s)).map((s) => (
                      <PersonCard key={s.id} s={s} onOpen={() => setStudentId(s.id)} onPlan={() => setLessonForm({ studentId: s.id })} />
                    ))}
                  </div>
                )}
              </section>
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="section-title">Mes groupes ({groups.length})</h2>
                  <Button size="sm" variant="secondary" onClick={() => setStudentForm({ isGroup: true })} disabled={activeStudents.length < 2} title={activeStudents.length < 2 ? "Ajoute d'abord au moins 2 élèves" : undefined}>
                    <Users className="h-3.5 w-3.5" /> Créer un groupe
                  </Button>
                </div>
                {groups.filter(studentMatch).length === 0 ? (
                  <Empty icon={<Users className="h-8 w-8" />} title="Aucun groupe">
                    Un groupe réunit plusieurs élèves pour un cours collectif (ex. « Groupe Brevet » avec Lina et Sarah). {activeStudents.length < 2 ? "Ajoute d'abord au moins 2 élèves." : ""}
                  </Empty>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {groups.filter(studentMatch).map((s) => (
                      <PersonCard key={s.id} s={s} onOpen={() => setStudentId(s.id)} onPlan={() => setLessonForm({ studentId: s.id })} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === "past" &&
            (pastFiltered.length === 0 ? (
              <Empty
                title={(past.data ?? []).length ? "Aucune séance ne correspond aux filtres" : "Aucune séance passée pour l'instant"}
                action={activeCount ? <Button size="sm" variant="secondary" onClick={() => setFl(DEFAULT_FILTERS)}>Effacer les filtres</Button> : undefined}
              />
            ) : (
              <Card title="Séances passées">
                <LessonTable lessons={pastFiltered} past onOpen={(id) => setLesson({ id, tab: "after" })} />
              </Card>
            ))}
        </>
      )}

      {lessonForm && <LessonForm open studentId={lessonForm.studentId} students={all} onClose={() => setLessonForm(null)} />}
      {studentForm && <StudentForm open initial={studentForm} students={all} onClose={() => setStudentForm(null)} />}
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

// ───────────── Filtres ─────────────

type Filters = {
  q: string;
  who: string; // "all" ou id d'élève / de groupe
  kind: "all" | "student" | "group";
  period: "all" | "today" | "week" | "next7" | "month" | "custom";
  from: string;
  to: string;
  subject: string;
  prep: "all" | "todo" | "urgent" | "ready";
  status: "all" | "DONE" | "CANCELLED" | "PLANNED";
};

const DEFAULT_FILTERS: Filters = { q: "", who: "all", kind: "all", period: "all", from: "", to: "", subject: "all", prep: "all", status: "all" };
const FILTER_KEY = "mlos-cours-filtres";

/** Filtres mémorisés sur cet appareil (facultatif : tout fonctionne sans). */
function useStoredFilters(): [Filters, (f: Filters) => void] {
  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (raw) setF({ ...DEFAULT_FILTERS, ...JSON.parse(raw) });
    } catch {}
  }, []);
  const set = (v: Filters) => {
    setF(v);
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(v));
    } catch {}
  };
  return [f, set];
}

function periodRange(f: Filters, mode: "upcoming" | "past"): [string, string] | null {
  const t = today();
  switch (f.period) {
    case "today":
      return [t, t];
    case "week": {
      const ws = startOfWeek(t);
      return [ws, addDays(ws, 6)];
    }
    case "next7":
      return mode === "past" ? [addDays(t, -7), t] : [t, addDays(t, 6)];
    case "month":
      return [t.slice(0, 8) + "01", t.slice(0, 8) + "31"];
    case "custom":
      return [f.from || "0000-01-01", f.to || "9999-12-31"];
    default:
      return null;
  }
}

function applyFilters(list: Lesson[], f: Filters, mode: "upcoming" | "past") {
  const range = periodRange(f, mode);
  const q = f.q.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return list.filter((l) => {
    if (f.who !== "all" && l.studentId !== f.who && !(l.student.members ?? []).some((m) => m.id === f.who)) return false;
    if (f.kind === "group" && !l.student.isGroup) return false;
    if (f.kind === "student" && l.student.isGroup) return false;
    if (range && (l.date < range[0] || l.date > range[1])) return false;
    if (f.subject !== "all" && l.subject.trim() !== f.subject) return false;
    if (mode === "upcoming" && f.prep !== "all") {
      const st = l.readiness.state;
      if (f.prep === "ready" && st !== "ready") return false;
      if (f.prep === "urgent" && st !== "at_risk") return false;
      if (f.prep === "todo" && st === "ready") return false;
    }
    if (mode === "past" && f.status !== "all" && l.status !== f.status) return false;
    if (q) {
      const hay = `${l.student.name} ${l.subject} ${l.chapter ?? ""} ${l.remarks ?? ""} ${(l.student.members ?? []).map((m) => m.name).join(" ")}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function countActive(f: Filters, mode: "upcoming" | "past") {
  return [
    f.q.trim() !== "",
    f.who !== "all",
    f.kind !== "all",
    f.period !== "all",
    f.subject !== "all",
    mode === "upcoming" ? f.prep !== "all" : f.status !== "all",
  ].filter(Boolean).length;
}

function FilterBar({
  value: f,
  onChange,
  people,
  subjects,
  mode,
  resultCount,
  activeCount,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  people: Student[];
  subjects: string[];
  mode: "upcoming" | "past";
  resultCount: number;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Filters>) => onChange({ ...f, ...patch });
  return (
    <div className="card mb-4 space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Rechercher (élève, matière, chapitre, remarque…)" value={f.q} onChange={(e) => set({ q: e.target.value })} aria-label="Rechercher une séance" />
        </div>
        <Button size="sm" variant={open || activeCount ? "soft" : "secondary"} onClick={() => setOpen(!open)} aria-expanded={open}>
          <SlidersHorizontal className="h-4 w-4" /> Filtres{activeCount ? ` (${activeCount})` : ""}
        </Button>
        {activeCount > 0 && (
          <Button size="sm" variant="ghost" onClick={() => onChange(DEFAULT_FILTERS)}>
            <X className="h-4 w-4" /> Effacer
          </Button>
        )}
        <span className="ml-auto text-xs text-muted">
          {resultCount} séance{resultCount > 1 ? "s" : ""}
        </span>
      </div>

      {people.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => set({ who: "all" })} className={cx("rounded-full border px-3 py-1 text-xs font-medium", f.who === "all" ? "border-ink bg-ink text-bg" : "border-line text-ink-2")}>
            Tous
          </button>
          {people.map((p) => (
            <button key={p.id} onClick={() => set({ who: f.who === p.id ? "all" : p.id })} className={cx("rounded-full transition", f.who !== "all" && f.who !== p.id && "opacity-40")} aria-pressed={f.who === p.id}>
              <NameTag name={p.name} color={p.color} group={p.isGroup} />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="grid gap-3 border-t border-line/60 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Période">
            <select className="input" value={f.period} onChange={(e) => set({ period: e.target.value as Filters["period"] })}>
              <option value="all">Toutes les dates</option>
              <option value="today">Aujourd&apos;hui</option>
              <option value="week">Cette semaine</option>
              <option value="next7">{mode === "past" ? "7 derniers jours" : "7 prochains jours"}</option>
              <option value="month">Ce mois-ci</option>
              <option value="custom">Dates personnalisées…</option>
            </select>
          </Field>
          <Field label="Matière">
            <select className="input" value={f.subject} onChange={(e) => set({ subject: e.target.value })}>
              <option value="all">Toutes les matières</option>
              {subjects.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select className="input" value={f.kind} onChange={(e) => set({ kind: e.target.value as Filters["kind"] })}>
              <option value="all">Élèves et groupes</option>
              <option value="student">Cours individuels</option>
              <option value="group">Cours de groupe</option>
            </select>
          </Field>
          {mode === "upcoming" ? (
            <Field label="Préparation">
              <select className="input" value={f.prep} onChange={(e) => set({ prep: e.target.value as Filters["prep"] })}>
                <option value="all">Toutes</option>
                <option value="todo">À préparer</option>
                <option value="urgent">À préparer vite ⚠</option>
                <option value="ready">Prêtes ✓</option>
              </select>
            </Field>
          ) : (
            <Field label="Statut">
              <select className="input" value={f.status} onChange={(e) => set({ status: e.target.value as Filters["status"] })}>
                <option value="all">Tous</option>
                <option value="DONE">Réalisées</option>
                <option value="CANCELLED">Annulées</option>
                <option value="PLANNED">À compléter</option>
              </select>
            </Field>
          )}
          {f.period === "custom" && (
            <>
              <Field label="Du">
                <input type="date" className="input" value={f.from} onChange={(e) => set({ from: e.target.value })} />
              </Field>
              <Field label="Au">
                <input type="date" className="input" value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} />
              </Field>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PersonCard({ s, onOpen, onPlan }: { s: Student; onOpen: () => void; onPlan: () => void }) {
  const t = today();
  const { fmt } = useMoney();
  return (
    <div className={cx("card flex flex-col overflow-hidden", s.archived && "opacity-60")}>
      <div className="h-1.5" style={{ background: s.color }} />
      <div className="flex flex-1 flex-col p-4">
        <button onClick={onOpen} className="text-left">
          <NameTag name={s.name} color={s.color} group={s.isGroup} size="lg" />
          <div className="mt-2 text-xs text-muted">{[s.level, s.subjects].filter(Boolean).join(" · ") || (s.isGroup ? "Cours collectif" : "Niveau et matières non précisés")}</div>
        </button>
        {s.isGroup && s.members.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {s.members.map((m) => (
              <NameTag key={m.id} name={m.name} color={m.color} size="sm" />
            ))}
          </div>
        )}
        {!s.isGroup && s.groups.length > 0 && <p className="mt-2 text-xs text-ink-2">Groupe : {s.groups.map((g) => g.name).join(", ")}</p>}
        {s.goals && <p className="mt-2 line-clamp-2 text-xs text-ink-2">🎯 {s.goals}</p>}
        <p className="mt-2 text-xs text-ink-2">💶 {rateLabel(s.billingMode, s.rate, fmt)}</p>
        <p className="mt-2 text-xs text-muted">
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
          <div className="mt-auto flex gap-2 pt-3">
            <Button size="sm" onClick={onPlan}>
              <CalendarPlus className="h-3.5 w-3.5" /> Planifier
            </Button>
            <Button size="sm" variant="secondary" onClick={onOpen}>
              Voir la fiche
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Tableau des séances (ordinateur) ; liste compacte sur téléphone. */
function LessonTable({ lessons, onOpen, past }: { lessons: Lesson[]; onOpen: (id: string, tab?: DetailTab) => void; past?: boolean }) {
  const t = today();
  const { fmt } = useMoney();
  const payBadge = (l: Lesson) =>
    l.incomeId ? <Badge tone="success">Payée ✓</Badge> : l.price && l.status === "DONE" ? <Badge tone="danger">À payer · {fmt(l.price)}</Badge> : l.price && l.status !== "CANCELLED" ? <Badge>{fmt(l.price)}</Badge> : <span className="text-xs text-muted">—</span>;
  const [all, setAll] = useState(false);
  const shown = all ? lessons : lessons.slice(0, 15);
  const status = (l: Lesson) => {
    if (past) return l.status === "DONE" ? { tone: "success" as const, text: "Réalisée" } : l.status === "CANCELLED" ? { tone: "neutral" as const, text: "Annulée" } : { tone: "warning" as const, text: "À compléter" };
    return prepSentence(l);
  };
  return (
    <div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Heure</th>
              <th className="py-2 pr-3 font-medium">Élève / groupe</th>
              <th className="py-2 pr-3 font-medium">Matière</th>
              <th className="py-2 pr-3 font-medium">{past ? "Statut" : "Préparation"}</th>
              {past && <th className="py-2 pr-3 font-medium">Paiement</th>}
              <th className="py-2 font-medium">{past ? "Remarque" : ""}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const st = status(l);
              return (
                <tr key={l.id} onClick={() => onOpen(l.id)} className="cursor-pointer border-b border-line/50 transition last:border-0 hover:bg-surface-2/60">
                  <td className="whitespace-nowrap py-2.5 pr-3 font-medium text-ink">
                    <span className="inline-block first-letter:uppercase">{relativeDay(l.date, t)}</span>
                    <div className="text-[11px] font-normal text-muted">{fmtDayNum(l.date)}</div>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-ink-2">
                    {formatTime(l.startTime)} – {formatTime(l.endTime)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <NameTag name={l.student.name} color={l.student.color} group={l.student.isGroup} />
                  </td>
                  <td className="py-2.5 pr-3 text-ink">
                    {l.subject}
                    {l.chapter && <div className="text-[11px] text-muted">{l.chapter}</div>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={st.tone}>{st.text}</Badge>
                  </td>
                  {past && <td className="py-2.5 pr-3">{payBadge(l)}</td>}
                  <td className="max-w-[16rem] py-2.5 text-right">
                    {past ? (
                      <span className="line-clamp-1 text-left text-xs text-muted">{l.remarks ?? "—"}</span>
                    ) : l.readiness.state !== "ready" && l.prepItems.length > 0 ? (
                      <Button size="sm" variant="soft" onClick={(e) => { e.stopPropagation(); onOpen(l.id, "prep"); }}>
                        <ListChecks className="h-3.5 w-3.5" /> Préparer
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line/60 sm:hidden">
        {shown.map((l) => {
          const st = status(l);
          return (
            <li key={l.id}>
              <button onClick={() => onOpen(l.id)} className="flex w-full items-start gap-3 py-3 text-left">
                <div className="w-20 shrink-0 text-sm">
                  <div className="font-medium text-ink first-letter:uppercase">{relativeDay(l.date, t)}</div>
                  <div className="text-xs text-muted">{formatTime(l.startTime)}</div>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <NameTag name={l.student.name} color={l.student.color} group={l.student.isGroup} size="sm" />
                  <div className="truncate text-xs text-ink-2">
                    {l.subject}
                    {l.chapter ? ` · ${l.chapter}` : ""}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={st.tone}>{st.text}</Badge>
                    {past && payBadge(l)}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {lessons.length > 15 && (
        <div className="mt-2 text-center">
          <button className="text-xs font-medium text-primary-strong" onClick={() => setAll(!all)}>
            {all ? "Réduire" : `Voir les ${lessons.length} séances`}
          </button>
        </div>
      )}
    </div>
  );
}

/** Emploi du temps de la semaine : une colonne par jour, chaque séance dans la couleur de l'élève. */
function WeekGrid({ lessons, onOpen }: { lessons: Lesson[]; onOpen: (id: string) => void }) {
  const [ws, setWs] = useState(startOfWeek(today()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const t = today();
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button size="sm" variant="ghost" onClick={() => setWs(addDays(ws, -7))}>
          ← Semaine précédente
        </Button>
        <span className="text-sm font-medium text-ink">
          Du {fmtDayNum(ws)} au {fmtDayNum(addDays(ws, 6))}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setWs(addDays(ws, 7))}>
          Semaine suivante →
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-7">
        {days.map((d) => {
          const list = lessons.filter((l) => l.date === d);
          return (
            <div key={d} className={cx("min-h-[6rem] rounded-xl border border-line/70 p-2", d === t && "ring-2 ring-primary/40")}>
              <div className="mb-2 text-xs font-semibold text-ink first-letter:uppercase">{new Date(d + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })}</div>
              <div className="space-y-1.5">
                {list.length === 0 && <p className="text-[11px] text-muted">—</p>}
                {list.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onOpen(l.id)}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-[11px] shadow-sm transition hover:brightness-95"
                    style={{ background: l.student.color, color: textOn(l.student.color) }}
                  >
                    <div className="font-semibold">
                      {formatTime(l.startTime)} · {l.student.name}
                    </div>
                    <div className="truncate opacity-90">{l.subject}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
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
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-display text-2xl font-semibold" style={{ background: l.student.color, color: textOn(l.student.color) }}>
          {l.student.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Prochaine séance</div>
          <div className="font-display text-xl font-semibold text-ink">
            <span className="first-letter:uppercase inline-block">{relativeDay(l.date, today())}</span> à {formatTime(l.startTime)}
          </div>
          <div className="my-1">
            <NameTag name={l.student.name} color={l.student.color} group={l.student.isGroup} size="lg" />
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
  const who = newStudent ? ns.name.trim() || "ton nouvel élève" : student ? (student.isGroup ? `le groupe ${student.name}` : student.name) : "—";

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

        <Section n={1} title="Avec quel élève ou quel groupe ?">
          <div className="flex flex-wrap gap-2">
            {active.map((s) => {
              const on = !newStudent && f.studentId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setNewStudent(false); setF({ ...f, studentId: s.id, subject: "" }); }}
                  className={cx("rounded-full transition", on ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "opacity-55 hover:opacity-90")}
                  aria-pressed={on}
                >
                  <NameTag name={s.name} color={s.color} group={s.isGroup} size="lg" />
                </button>
              );
            })}
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

function StudentForm({ open, initial, students, onClose }: { open: boolean; initial: Partial<Student>; students: Student[]; onClose: () => void }) {
  const { toast } = useUi();
  const isGroup = !!initial.isGroup;
  const used = new Set(students.map((x) => x.color));
  const freeColor = COLOR_PALETTE.find((c) => !used.has(c)) ?? COLOR_PALETTE[students.length % COLOR_PALETTE.length];
  const [f, setF] = useState({
    name: initial.name ?? "",
    level: initial.level ?? "",
    subjects: initial.subjects ?? "",
    goals: initial.goals ?? "",
    notes: initial.notes ?? "",
    color: initial.color ?? freeColor,
    archived: initial.archived ?? false,
    memberIds: (initial.members ?? []).map((m) => m.id),
    billingMode: (initial.billingMode ?? "SESSION") as BillingMode,
    rate: initial.rate != null ? String(initial.rate) : "",
  });
  const { currency, fmt } = useMoney();
  const [saving, setSaving] = useState(false);
  const candidates = students.filter((x) => !x.isGroup && !x.archived && x.id !== initial.id);
  async function save() {
    if (!f.name.trim()) return toast(isGroup ? "Donne un nom au groupe" : "Le prénom est obligatoire", "danger");
    if (isGroup && f.memberIds.length < 2) return toast("Choisis au moins 2 élèves pour le groupe", "danger");
    setSaving(true);
    try {
      const body = { ...f, isGroup, level: f.level || null, subjects: f.subjects || null, goals: f.goals || null, notes: f.notes || null, rate: f.rate === "" || f.billingMode === "FREE" ? null : Number(f.rate) };
      if (initial.id) await api(`/api/students/${initial.id}`, { method: "PATCH", body });
      else await api("/api/students", { body });
      await refreshAll();
      toast(initial.id ? "Modifications enregistrées" : isGroup ? "Groupe créé 👥" : "Élève ajouté");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial.id ? (isGroup ? "Modifier le groupe" : "Modifier l'élève") : isGroup ? "Nouveau groupe" : "Nouvel élève"}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} loading={saving}>Enregistrer</Button></>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2/60 p-3">
          <span className="text-xs text-muted">Aperçu :</span>
          <NameTag name={f.name || (isGroup ? "Nom du groupe" : "Prénom")} color={f.color} group={isGroup} size="lg" />
        </div>
        <Field label={isGroup ? "Nom du groupe *" : "Prénom / nom *"}>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={isGroup ? "Groupe Brevet" : "Lina"} />
        </Field>
        {isGroup && (
          <div>
            <span className="label">Élèves du groupe * (au moins 2)</span>
            {candidates.length < 2 ? (
              <Notice tone="warning">Ajoute d&apos;abord au moins 2 élèves, puis crée le groupe.</Notice>
            ) : (
              <div className="flex flex-wrap gap-2">
                {candidates.map((c) => {
                  const on = f.memberIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setF({ ...f, memberIds: on ? f.memberIds.filter((x) => x !== c.id) : [...f.memberIds, c.id] })}
                      className={cx("rounded-full transition", on ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "opacity-50 hover:opacity-90")}
                      aria-pressed={on}
                    >
                      <NameTag name={c.name} color={c.color} size="lg" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Niveau (facultatif)">
            <input className="input" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} placeholder="3e, Terminale…" />
          </Field>
          <Field label="Matières (facultatif)">
            <input className="input" value={f.subjects} onChange={(e) => setF({ ...f, subjects: e.target.value })} placeholder="Maths, Physique" />
          </Field>
        </div>
        <div className="space-y-2 rounded-2xl border border-line p-3">
          <span className="label">💶 Paiement {isGroup ? "du groupe" : "de l'élève"}</span>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(BILLING_LABELS) as BillingMode[]).map((m) => (
              <button key={m} type="button" onClick={() => setF({ ...f, billingMode: m })} className={chip(f.billingMode === m)}>
                {BILLING_LABELS[m]}
              </button>
            ))}
          </div>
          {f.billingMode !== "FREE" && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step="0.5"
                className="input w-36"
                value={f.rate}
                onChange={(e) => setF({ ...f, rate: e.target.value })}
                placeholder="Montant"
                aria-label="Tarif"
              />
              <span className="text-sm text-ink-2">
                {currency} {f.billingMode === "SESSION" ? "par séance" : f.billingMode === "HOUR" ? "par heure" : "par mois"}
              </span>
            </div>
          )}
          <p className="text-xs text-muted">
            {f.billingMode === "SESSION" && "Chaque séance réalisée est due. Tu coches ensuite celles qui sont payées."}
            {f.billingMode === "HOUR" && `Le prix d'une séance est calculé selon sa durée (ex. 1 h 30 = ${f.rate ? fmt(Number(f.rate) * 1.5) : "1,5 × le tarif"}).`}
            {f.billingMode === "MONTH" && "Le forfait est dû chaque mois où il y a au moins une séance."}
            {f.billingMode === "FREE" && "Aucun paiement suivi pour " + (isGroup ? "ce groupe." : "cet élève.")}
            {isGroup && f.billingMode !== "FREE" && " Pour un groupe, indique le montant total payé pour le groupe."}
          </p>
        </div>
        <div>
          <span className="label">Couleur {isGroup ? "du groupe" : "de l'élève"}</span>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_PALETTE.map((c) => (
              <button key={c} type="button" onClick={() => setF({ ...f, color: c })} className={cx("h-8 w-8 rounded-full ring-offset-2 ring-offset-surface", f.color === c && "ring-2 ring-ink")} style={{ background: c }} aria-label={`Couleur ${c}`} />
            ))}
            <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent" aria-label="Couleur personnalisée" />
          </div>
        </div>
        <Field label="Objectifs (facultatif)">
          <textarea className="input min-h-[60px]" value={f.goals} onChange={(e) => setF({ ...f, goals: e.target.value })} />
        </Field>
        <Field label="Notes (facultatif)">
          <textarea className="input min-h-[60px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
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
          <NameTag name={l.student.name} color={l.student.color} group={l.student.isGroup} size="lg" />
          <span>{l.subject}</span>
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
            <LessonPayment l={l} onChanged={() => mutate()} />
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
    if (!(await confirm({ title: `Supprimer ${s!.name} ?`, message: s!.isGroup ? "Le groupe et ses séances seront supprimés. Les élèves du groupe sont conservés." : "Toutes ses séances, préparations et ressources seront supprimées. Pour garder l'historique, préfère « Archiver ».", danger: true, confirmLabel: "Supprimer définitivement" }))) return;
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
      title={<NameTag name={s.name} color={s.color} group={s.isGroup} size="lg" />}
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
        {s.isGroup && (
          <div>
            <span className="text-muted">Élèves du groupe :</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {s.members.map((m) => (
                <NameTag key={m.id} name={m.name} color={m.color} />
              ))}
            </div>
          </div>
        )}
        {!s.isGroup && s.groups.length > 0 && (
          <div>
            <span className="text-muted">Fait partie de :</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {s.groups.map((g) => (
                <NameTag key={g.id} name={g.name} color={g.color} group />
              ))}
            </div>
          </div>
        )}
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

/** Paiement d'une séance : montant, statut payé / à payer, encaissement en 1 clic. */
function LessonPayment({ l, onChanged }: { l: Lesson; onChanged: () => void }) {
  const { fmt, currency } = useMoney();
  const { toast, confirm } = useUi();
  const [price, setPrice] = useState(l.price != null ? String(l.price) : "");
  const [method, setMethod] = useState("CASH");
  const [busy, setBusy] = useState(false);
  const monthly = !l.price && !l.incomeId;

  async function savePrice() {
    await api(`/api/lessons/${l.id}`, { method: "PATCH", body: { price: price === "" ? null : Number(price) } });
    onChanged();
    refreshAll();
    toast("Montant enregistré");
  }
  async function pay() {
    const amount = price === "" ? null : Number(price);
    if (!amount) return toast("Indique d'abord le montant de la séance", "danger");
    setBusy(true);
    try {
      await api(`/api/lessons/${l.id}/pay`, { body: { amount, method } });
      onChanged();
      await refreshAll();
      toast(`Séance payée ✓ — ${fmt(amount)} ajoutés à tes revenus`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    } finally {
      setBusy(false);
    }
  }
  async function unpay() {
    if (!(await confirm({ title: "Annuler le paiement ?", message: "La séance redeviendra « à payer » et le montant sera retiré de tes revenus.", confirmLabel: "Annuler le paiement", danger: true }))) return;
    await api(`/api/lessons/${l.id}/pay`, { method: "DELETE" });
    onChanged();
    await refreshAll();
    toast("Paiement annulé");
  }

  return (
    <div className="space-y-2 rounded-2xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">💶 Paiement de la séance</span>
        {l.incomeId ? <Badge tone="success">Payée ✓</Badge> : l.price ? <Badge tone={l.status === "DONE" ? "danger" : "neutral"}>{l.status === "DONE" ? "À payer" : "Pas encore due"}</Badge> : <Badge>Forfait / gratuit</Badge>}
      </div>
      {l.incomeId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
          <span>{l.price ? `${fmt(l.price)} reçus — comptés dans tes revenus.` : "Réglée."}</span>
          <Button size="sm" variant="ghost" onClick={unpay}>
            Annuler le paiement
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={`Montant (${currency})`}>
            <input type="number" min={0} step="0.5" className="input h-9 w-28" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => String(l.price ?? "") !== price && savePrice()} />
          </Field>
          <select className="input h-9 w-auto py-1" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Moyen de paiement">
            <option value="CASH">Espèces</option>
            <option value="TRANSFER">Virement</option>
            <option value="CARD">Carte</option>
            <option value="CHECK">Chèque</option>
            <option value="OTHER">Autre</option>
          </select>
          <Button size="sm" variant="success" onClick={pay} loading={busy}>
            Marquer comme payée
          </Button>
        </div>
      )}
      {monthly && !l.incomeId && <p className="text-xs text-muted">Élève au forfait mensuel ou gratuit : le paiement se fait dans l&apos;onglet « 💶 Paiements ». Tu peux aussi saisir un montant ici pour cette séance.</p>}
    </div>
  );
}
