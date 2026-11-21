"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, ChevronRight, ExternalLink, FileText, FolderPlus, Plus, Save, Search, Trash2, Upload } from "lucide-react";
import { api, cn, fullName, qsOf, refreshAll, useApi } from "@/lib/client";
import { DOCUMENT_TYPES } from "@/lib/constants";
import { shortDate } from "@/lib/dates";
import type { Chapter } from "@/lib/types";
import { Badge, Button, Card, Dialog, Empty, Field, Input, Loading, PageHeader, Segmented, Select, Textarea, useConfirm, useToast } from "@/components/ui";
import { SubjectDot, useRefs } from "@/components/shared";

type Exercise = { id?: string; title: string; statement: string; correction: string; difficulty: "EASY" | "MEDIUM" | "HARD" };
type LessonFull = {
  id: string; chapterId: string; title: string; objectives: string | null; content: string | null; links: string | null; notes: string | null; status: "DRAFT" | "READY";
  chapter: Chapter & { subject: { id: string; name: string; color: string } };
  exercises: (Exercise & { statement: string | null; correction: string | null })[];
  documents: { id: string; name: string; type: string; size: number | null; url: string | null }[];
  sessions: { session: { id: string; date: string; startTime: string; participants: { student: { firstName: string; lastName: string } }[] } }[];
};

function PrepInner() {
  const sp = useSearchParams();
  const refs = useRefs();
  const toast = useToast();
  const confirm = useConfirm();
  const [subjectId, setSubject] = useState("");
  const [levelId, setLevel] = useState("");
  const [q, setQ] = useState("");
  const [lessonId, setLessonId] = useState<string | null>(sp.get("lesson"));
  const [newChapter, setNewChapter] = useState(false);
  const [newLesson, setNewLesson] = useState<string | null>(null);
  const chapters = useApi<Chapter[]>(`/api/chapters${qsOf({ subjectId, levelId })}`);

  const grouped = useMemo(() => {
    const m = new Map<string, { subject: Chapter["subject"]; levels: Map<string, Chapter[]> }>();
    for (const c of chapters.data ?? []) {
      if (q && !c.title.toLowerCase().includes(q.toLowerCase()) && !c.lessons.some((l) => l.title.toLowerCase().includes(q.toLowerCase()))) continue;
      const g = m.get(c.subjectId) ?? { subject: c.subject, levels: new Map() };
      const lk = c.level?.name ?? "Tous niveaux";
      g.levels.set(lk, [...(g.levels.get(lk) ?? []), c]);
      m.set(c.subjectId, g);
    }
    return [...m.values()];
  }, [chapters.data, q]);

  const delChapter = async (c: Chapter) => {
    if ((await confirm({ title: `Supprimer le chapitre « ${c.title} » ?`, text: `Ses ${c.lessons.length} leçon(s) et exercices seront supprimés.`, danger: true })) === false) return;
    await api(`/api/chapters/${c.id}`, { method: "DELETE" });
    toast.success("Chapitre supprimé.");
    chapters.mutate();
  };

  return (
    <div>
      <PageHeader title="Préparations pédagogiques" icon={<BookOpen className="h-5 w-5" />} subtitle="Bibliothèque réutilisable : Matière → Niveau → Chapitre → Leçon → Exercices → Devoirs." actions={<Button onClick={() => setNewChapter(true)}><FolderPlus className="h-4 w-4" />Chapitre</Button>} />
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card bodyClass="space-y-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une leçon…" /></div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={subjectId} onChange={(e) => setSubject(e.target.value)} options={refs.subjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="Matières" />
            <Select value={levelId} onChange={(e) => setLevel(e.target.value)} options={refs.levels.map((s) => ({ value: s.id, label: s.name }))} placeholder="Niveaux" />
          </div>
          {!chapters.data ? <Loading /> : grouped.length === 0 ? <Empty title="Aucun chapitre" action={<Button size="sm" onClick={() => setNewChapter(true)}>Créer un chapitre</Button>} /> : (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              {grouped.map((g) => (
                <div key={g.subject.id}>
                  <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><SubjectDot color={g.subject.color} />{g.subject.name}</div>
                  {[...g.levels.entries()].map(([lvl, chs]) => (
                    <div key={lvl} className="ml-1 border-l border-line pl-3">
                      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">{lvl}</div>
                      {chs.map((c) => (
                        <div key={c.id} className="mt-1">
                          <div className="group flex items-center gap-1 text-sm font-medium text-ink">
                            <ChevronRight className="h-3.5 w-3.5 text-muted" /><span className="flex-1 truncate">{c.title}</span>
                            <button onClick={() => setNewLesson(c.id)} className="rounded p-0.5 text-muted opacity-0 hover:text-primary-strong group-hover:opacity-100" title="Ajouter une leçon"><Plus className="h-3.5 w-3.5" /></button>
                            <button onClick={() => delChapter(c)} className="rounded p-0.5 text-muted opacity-0 hover:text-danger group-hover:opacity-100" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                          <ul className="ml-5">
                            {c.lessons.map((l) => (
                              <li key={l.id}>
                                <button onClick={() => setLessonId(l.id)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm", lessonId === l.id ? "bg-primary-soft text-primary-strong" : "hover:bg-surface-2/60")}>
                                  <span className="flex-1 truncate">{l.title}</span>
                                  {l.status === "DRAFT" ? <span className="h-1.5 w-1.5 rounded-full bg-warning" title="Brouillon" /> : <span className="h-1.5 w-1.5 rounded-full bg-success" title="Prête" />}
                                </button>
                              </li>
                            ))}
                            {c.lessons.length === 0 && <li><button onClick={() => setNewLesson(c.id)} className="px-2 py-1 text-xs text-primary-strong">+ Première leçon</button></li>}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>
        <div>{lessonId ? <LessonEditor id={lessonId} onDeleted={() => { setLessonId(null); chapters.mutate(); }} onSaved={() => chapters.mutate()} /> : <Empty icon={<BookOpen className="h-7 w-7" />} title="Choisissez ou créez une leçon">Chaque leçon regroupe objectifs, explication, exercices avec corrections, documents et liens. Rattachez-la ensuite à vos séances.</Empty>}</div>
      </div>
      {newChapter && <ChapterDialog onClose={(id) => { setNewChapter(false); chapters.mutate(); if (id) setNewLesson(id); }} />}
      {newLesson && <NewLessonDialog chapterId={newLesson} onClose={(id) => { setNewLesson(null); chapters.mutate(); if (id) setLessonId(id); }} />}
    </div>
  );
}

function ChapterDialog({ onClose }: { onClose: (id?: string) => void }) {
  const refs = useRefs();
  const [v, setV] = useState({ subjectId: "", levelId: "", title: "" });
  const save = async () => {
    const c = await api<{ id: string }>("/api/chapters", { body: v });
    onClose(c.id);
  };
  return (
    <Dialog open onClose={() => onClose()} size="sm" title="Nouveau chapitre" footer={<><Button variant="secondary" onClick={() => onClose()}>Annuler</Button><Button disabled={!v.subjectId || !v.title.trim()} onClick={save}>Créer</Button></>}>
      <div className="grid gap-3">
        <Field label="Matière" required><Select value={v.subjectId} onChange={(e) => setV({ ...v, subjectId: e.target.value })} options={refs.subjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="Choisir…" /></Field>
        <Field label="Niveau"><Select value={v.levelId} onChange={(e) => setV({ ...v, levelId: e.target.value })} options={refs.levels.map((s) => ({ value: s.id, label: s.name }))} placeholder="Tous niveaux" /></Field>
        <Field label="Titre du chapitre" required><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

function NewLessonDialog({ chapterId, onClose }: { chapterId: string; onClose: (id?: string) => void }) {
  const [title, setTitle] = useState("");
  const save = async () => {
    const l = await api<{ id: string }>("/api/lessons", { body: { chapterId, title } });
    onClose(l.id);
  };
  return (
    <Dialog open onClose={() => onClose()} size="sm" title="Nouvelle leçon" footer={<><Button variant="secondary" onClick={() => onClose()}>Annuler</Button><Button disabled={!title.trim()} onClick={save}>Créer</Button></>}>
      <Field label="Titre de la leçon"><Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && title.trim() && save()} /></Field>
    </Dialog>
  );
}

function LessonEditor({ id, onDeleted, onSaved }: { id: string; onDeleted: () => void; onSaved: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: l, mutate } = useApi<LessonFull>(`/api/lessons/${id}`);
  const [v, setV] = useState<{ title: string; objectives: string; content: string; links: string; notes: string; status: "DRAFT" | "READY"; exercises: Exercise[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCorr, setShowCorr] = useState<Record<number, boolean>>({});
  useEffect(() => {
    if (l) setV({ title: l.title, objectives: l.objectives ?? "", content: l.content ?? "", links: l.links ?? "", notes: l.notes ?? "", status: l.status, exercises: l.exercises.map((e) => ({ id: e.id, title: e.title, statement: e.statement ?? "", correction: e.correction ?? "", difficulty: e.difficulty })) });
  }, [l]);
  if (!l || !v) return <Loading rows={6} />;
  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/lessons/${id}`, { method: "PUT", body: { ...v, chapterId: l.chapterId } });
      toast.success("Préparation enregistrée.");
      mutate();
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if ((await confirm({ title: "Supprimer cette leçon ?", danger: true })) === false) return;
    await api(`/api/lessons/${id}`, { method: "DELETE" });
    onDeleted();
  };
  const upload = async (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("lessonId", id);
    fd.set("chapterId", l.chapterId);
    fd.set("subjectId", l.chapter.subject.id);
    if (l.chapter.levelId) fd.set("levelId", l.chapter.levelId);
    try {
      await api("/api/documents", { form: fd });
      toast.success("Document ajouté à la leçon.");
      mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };
  const ex = (i: number, patch: Partial<Exercise>) => setV({ ...v, exercises: v.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted"><SubjectDot color={l.chapter.subject.color} />{l.chapter.subject.name} · {l.chapter.level?.name ?? "Tous niveaux"} · {l.chapter.title}</div>
          <div className="flex items-center gap-2">
            <Segmented value={v.status} onChange={(status) => setV({ ...v, status })} options={[{ value: "DRAFT", label: "Brouillon" }, { value: "READY", label: "Prête" }]} />
            <Button variant="danger-ghost" size="icon" onClick={remove} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
            <Button onClick={save} loading={saving}><Save className="h-4 w-4" />Enregistrer</Button>
          </div>
        </div>
        <div className="grid gap-3">
          <Field label="Titre de la leçon"><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className="text-base font-medium" /></Field>
          <Field label="Objectifs pédagogiques"><Textarea rows={3} value={v.objectives} onChange={(e) => setV({ ...v, objectives: e.target.value })} placeholder="Un objectif par ligne" /></Field>
          <Field label="Explication du cours"><Textarea rows={8} value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} placeholder="Déroulé, définitions, méthodes, exemples…" /></Field>
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between"><h3 className="section-title">Exercices et corrections ({v.exercises.length})</h3><Button size="sm" variant="soft" onClick={() => setV({ ...v, exercises: [...v.exercises, { title: `Exercice ${v.exercises.length + 1}`, statement: "", correction: "", difficulty: "MEDIUM" }] })}><Plus className="h-4 w-4" />Exercice</Button></div>
        <div className="space-y-3">
          {v.exercises.map((e, i) => (
            <div key={i} className="rounded-2xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input value={e.title} onChange={(x) => ex(i, { title: x.target.value })} className="h-9 flex-1" />
                <Select value={e.difficulty} onChange={(x) => ex(i, { difficulty: x.target.value as Exercise["difficulty"] })} options={{ EASY: "Facile", MEDIUM: "Moyen", HARD: "Difficile" }} className="h-9 w-auto" />
                <Button size="icon-sm" variant="danger-ghost" onClick={() => setV({ ...v, exercises: v.exercises.filter((_, j) => j !== i) })} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
              </div>
              <Textarea rows={3} className="mt-2" value={e.statement} onChange={(x) => ex(i, { statement: x.target.value })} placeholder="Énoncé" />
              <button className="mt-1 text-xs text-primary-strong" onClick={() => setShowCorr({ ...showCorr, [i]: !showCorr[i] })}>{showCorr[i] || e.correction ? "Correction" : "+ Ajouter la correction"}</button>
              {(showCorr[i] || e.correction) && <Textarea rows={3} className="mt-1 bg-success-soft/30" value={e.correction} onChange={(x) => ex(i, { correction: x.target.value })} placeholder="Correction" />}
            </div>
          ))}
          {v.exercises.length === 0 && <p className="text-sm text-muted">Aucun exercice pour l&apos;instant.</p>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3 p-4 sm:p-5">
          <h3 className="section-title">Ressources</h3>
          <Field label="Liens utiles (un par ligne)"><Textarea rows={3} value={v.links} onChange={(e) => setV({ ...v, links: e.target.value })} placeholder="https://…" /></Field>
          {v.links.split("\n").filter((x) => /^https?:\/\//.test(x.trim())).map((u) => <a key={u} href={u.trim()} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 truncate text-xs text-primary-strong hover:underline"><ExternalLink className="h-3 w-3" />{u}</a>)}
          <Field label="Remarques personnelles"><Textarea rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
        </div>
        <div className="card space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="section-title">Documents (PDF, Word, images)</h3>
            <label><input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.txt,image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} /><span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-primary-soft px-3 text-xs font-medium text-primary-strong"><Upload className="h-3.5 w-3.5" />Importer</span></label>
          </div>
          {l.documents.length === 0 ? <p className="text-sm text-muted">Aucun document.</p> : (
            <ul className="space-y-1.5">{l.documents.map((d) => <li key={d.id}><a href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:underline"><FileText className="h-4 w-4 text-primary-strong" /><span className="truncate">{d.name}</span><Badge>{DOCUMENT_TYPES[d.type as keyof typeof DOCUMENT_TYPES] ?? d.type}</Badge></a></li>)}</ul>
          )}
          <h3 className="section-title pt-2">Séances rattachées ({l.sessions.length})</h3>
          {l.sessions.length === 0 ? <p className="text-sm text-muted">Rattachez cette préparation depuis le formulaire d&apos;une séance.</p> : (
            <ul className="space-y-1 text-sm">{l.sessions.map(({ session: s }) => <li key={s.id}><Link href={`/seances?open=${s.id}`} className="hover:underline">{shortDate(s.date)} {s.startTime} — {s.participants.map((p) => fullName(p.student)).join(", ")}</Link></li>)}</ul>
          )}
          <Link href={`/devoirs?lesson=${l.id}`} className="inline-block text-xs text-primary-strong hover:underline">Créer un devoir à partir de cette leçon →</Link>
        </div>
      </div>
      <div className="flex justify-end"><Button onClick={() => { save(); refreshAll(); }} loading={saving}><Save className="h-4 w-4" />Enregistrer la préparation</Button></div>
    </div>
  );
}

export default function PreparationsPage() {
  return <Suspense><PrepInner /></Suspense>;
}
