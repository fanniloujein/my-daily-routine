"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Circle, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { api, fullName, qsOf, useApi } from "@/lib/client";
import { HOMEWORK_TYPES } from "@/lib/constants";
import { shortDate, today } from "@/lib/dates";
import type { Homework } from "@/lib/types";
import { Badge, Button, Dialog, Empty, Field, Input, Loading, PageHeader, Segmented, Select, Textarea, useConfirm } from "@/components/ui";
import { SubjectDot, useRefs } from "@/components/shared";

function HomeworkInner() {
  const sp = useSearchParams();
  const refs = useRefs();
  const confirm = useConfirm();
  const [status, setStatus] = useState<"PENDING" | "DONE" | "">("PENDING");
  const [type, setType] = useState("");
  const [studentId, setStudent] = useState("");
  const [edit, setEdit] = useState<Homework | "new" | null>(null);
  const { data, mutate } = useApi<Homework[]>(`/api/homework${qsOf({ status, type, studentId })}`);
  const t = today();
  useEffect(() => { if (sp.get("lesson")) setEdit("new"); }, [sp]);
  const toggle = async (h: Homework) => { await api(`/api/homework/${h.id}`, { method: "PATCH", body: { status: h.status === "DONE" ? "PENDING" : "DONE" } }); mutate(); };
  const remove = async (h: Homework) => { if ((await confirm({ title: "Supprimer ce devoir ?", danger: true })) !== false) { await api(`/api/homework/${h.id}`, { method: "DELETE" }); mutate(); } };
  return (
    <div>
      <PageHeader title="Devoirs" icon={<FileText className="h-5 w-5" />} subtitle="Devoirs à préparer, corrections, séries à imprimer, révisions, examens blancs." actions={<Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Nouveau</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Segmented value={status} onChange={setStatus} options={[{ value: "PENDING", label: "En attente" }, { value: "DONE", label: "Terminés" }, { value: "", label: "Tous" }]} />
        <Select className="w-auto" value={type} onChange={(e) => setType(e.target.value)} options={HOMEWORK_TYPES} placeholder="Tous les types" />
        <Select className="w-auto" value={studentId} onChange={(e) => setStudent(e.target.value)} options={refs.students.map((s) => ({ value: s.id, label: fullName(s) }))} placeholder="Tous les élèves" />
      </div>
      {!data ? <Loading /> : data.length === 0 ? <Empty title="Aucun devoir" action={<Button onClick={() => setEdit("new")}>Créer un devoir</Button>} /> : (
        <ul className="space-y-2">
          {data.map((h) => {
            const late = h.status === "PENDING" && h.dueDate && h.dueDate < t;
            return (
              <li key={h.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
                <button onClick={() => toggle(h)} aria-label="Basculer">{h.status === "DONE" ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted" />}</button>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${h.status === "DONE" ? "text-muted line-through" : ""}`}>{h.title}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge tone="info">{HOMEWORK_TYPES[h.type as keyof typeof HOMEWORK_TYPES]}</Badge>
                    {h.student && <span>{fullName(h.student)}</span>}
                    {h.subject && <span className="inline-flex items-center gap-1"><SubjectDot color={h.subject.color} />{h.subject.name}</span>}
                    {h.lesson && <span>· {h.lesson.title}</span>}
                    {h.grade != null && <span>· Note : {h.grade}/{h.maxGrade ?? 20}</span>}
                  </div>
                </div>
                {h.dueDate && <Badge tone={late ? "danger" : h.dueDate === t ? "warning" : "muted"}>{late ? "En retard · " : ""}{shortDate(h.dueDate)}</Badge>}
                <Button size="icon-sm" variant="ghost" onClick={() => setEdit(h)} aria-label="Modifier"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon-sm" variant="danger-ghost" onClick={() => remove(h)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
              </li>
            );
          })}
        </ul>
      )}
      {edit && <HomeworkDialog hw={edit === "new" ? null : edit} lessonId={sp.get("lesson")} onClose={() => { setEdit(null); mutate(); }} />}
    </div>
  );
}

function HomeworkDialog({ hw, lessonId, onClose }: { hw: Homework | null; lessonId: string | null; onClose: () => void }) {
  const refs = useRefs();
  const lessons = useApi<{ id: string; title: string; chapter: { subject: { name: string } } }[]>("/api/lessons");
  const [v, setV] = useState({ title: hw?.title ?? "", type: hw?.type ?? "TO_SUBMIT", studentId: hw?.studentId ?? "", subjectId: hw?.subjectId ?? "", levelId: hw?.levelId ?? "", lessonId: hw?.lessonId ?? lessonId ?? "", dueDate: hw?.dueDate ?? "", status: hw?.status ?? "PENDING", grade: hw?.grade != null ? String(hw.grade) : "", maxGrade: hw?.maxGrade != null ? String(hw.maxGrade) : "20", notes: hw?.notes ?? "" });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try {
      const body = { ...v, grade: v.grade === "" ? null : Number(v.grade), maxGrade: v.grade === "" ? null : Number(v.maxGrade) };
      await api(hw ? `/api/homework/${hw.id}` : "/api/homework", { method: hw ? "PUT" : "POST", body });
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
  };
  return (
    <Dialog open onClose={onClose} title={hw ? "Modifier le devoir" : "Nouveau devoir"} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} disabled={!v.title.trim()}>Enregistrer</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Intitulé" required className="sm:col-span-2"><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="Type"><Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })} options={HOMEWORK_TYPES} /></Field>
        <Field label="Date limite"><Input type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} /></Field>
        <Field label="Élève"><Select value={v.studentId} onChange={(e) => { const s = refs.students.find((x) => x.id === e.target.value); setV({ ...v, studentId: e.target.value, subjectId: v.subjectId || (s?.subjects[0]?.id ?? ""), levelId: v.levelId || (s?.levelId ?? "") }); }} options={refs.students.map((s) => ({ value: s.id, label: fullName(s) }))} placeholder="—" /></Field>
        <Field label="Matière"><Select value={v.subjectId} onChange={(e) => setV({ ...v, subjectId: e.target.value })} options={refs.subjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="—" /></Field>
        <Field label="Leçon liée" className="sm:col-span-2"><Select value={v.lessonId} onChange={(e) => setV({ ...v, lessonId: e.target.value })} options={(lessons.data ?? []).map((l) => ({ value: l.id, label: `${l.chapter.subject.name} · ${l.title}` }))} placeholder="—" /></Field>
        <Field label="Statut"><Segmented value={v.status} onChange={(status) => setV({ ...v, status })} options={[{ value: "PENDING", label: "En attente" }, { value: "DONE", label: "Terminé" }]} /></Field>
        <div className="grid grid-cols-2 gap-2"><Field label="Note"><Input type="number" value={v.grade} onChange={(e) => setV({ ...v, grade: e.target.value })} /></Field><Field label="Sur"><Input type="number" value={v.maxGrade} onChange={(e) => setV({ ...v, maxGrade: e.target.value })} /></Field></div>
        <Field label="Remarques" className="sm:col-span-2"><Textarea rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
    </Dialog>
  );
}

export default function HomeworkPage() { return <Suspense><HomeworkInner /></Suspense>; }
