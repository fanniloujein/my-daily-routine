"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, ExternalLink, FileImage, FileSpreadsheet, FileText, FolderOpen, Link2, Search, Trash2, Upload } from "lucide-react";
import { api, fullName, qsOf, useApi } from "@/lib/client";
import { DOCUMENT_TYPES } from "@/lib/constants";
import { shortDate } from "@/lib/dates";
import type { Chapter, DocumentRow } from "@/lib/types";
import { Badge, Button, Dialog, Empty, Field, Input, Loading, PageHeader, Select, useConfirm, useToast } from "@/components/ui";
import { useRefs } from "@/components/shared";

const icon = (t: string) => (t === "IMAGE" ? FileImage : t === "EXCEL" ? FileSpreadsheet : t === "LINK" ? Link2 : FileText);
const size = (n: number | null) => (n == null ? "" : n > 1e6 ? `${(n / 1e6).toFixed(1)} Mo` : `${Math.ceil(n / 1e3)} Ko`);

function DocsInner() {
  const sp = useSearchParams();
  const refs = useRefs();
  const confirm = useConfirm();
  const [f, setF] = useState({ q: "", studentId: sp.get("studentId") ?? "", subjectId: "", levelId: "", chapterId: "", type: "" });
  const [add, setAdd] = useState(false);
  const { data, mutate } = useApi<DocumentRow[]>(`/api/documents${qsOf(f)}`);
  const chapters = useApi<Chapter[]>("/api/chapters");
  const remove = async (d: DocumentRow) => { if ((await confirm({ title: `Supprimer « ${d.name} » ?`, danger: true })) !== false) { await api(`/api/documents/${d.id}`, { method: "DELETE" }); mutate(); } };
  return (
    <div>
      <PageHeader title="Documents" icon={<FolderOpen className="h-5 w-5" />} subtitle="Bibliothèque classée par élève, matière, niveau, chapitre et type." actions={<Button onClick={() => setAdd(true)}><Upload className="h-4 w-4" />Ajouter</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-6">
        <div className="relative col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input className="pl-9" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Recherche rapide (nom, mots-clés)…" /></div>
        <Select value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })} options={refs.students.map((s) => ({ value: s.id, label: fullName(s) }))} placeholder="Élève" />
        <Select value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })} options={refs.subjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="Matière" />
        <Select value={f.levelId} onChange={(e) => setF({ ...f, levelId: e.target.value })} options={refs.levels.map((s) => ({ value: s.id, label: s.name }))} placeholder="Niveau" />
        <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={DOCUMENT_TYPES} placeholder="Type" />
        <Select className="col-span-2 md:col-span-2" value={f.chapterId} onChange={(e) => setF({ ...f, chapterId: e.target.value })} options={(chapters.data ?? []).map((c) => ({ value: c.id, label: `${c.subject.name} · ${c.title}` }))} placeholder="Chapitre" />
      </div>
      {!data ? <Loading /> : data.length === 0 ? <Empty icon={<FolderOpen className="h-6 w-6" />} title="Aucun document" action={<Button onClick={() => setAdd(true)}>Importer un fichier</Button>} /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((d) => {
            const I = icon(d.type);
            const href = d.size ? `/api/documents/${d.id}/file` : d.url ?? "#";
            return (
              <div key={d.id} className="card flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong"><I className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <a href={href} target="_blank" rel="noreferrer noopener" className="block truncate font-medium hover:underline">{d.name}</a>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs">
                    <Badge tone="info">{DOCUMENT_TYPES[d.type as keyof typeof DOCUMENT_TYPES] ?? d.type}</Badge>
                    {d.subject && <Badge>{d.subject.name}</Badge>}
                    {d.level && <Badge>{d.level.name}</Badge>}
                    {d.student && <Badge tone="accent">{fullName(d.student)}</Badge>}
                    {d.chapter && <Badge>{d.chapter.title}</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted">{shortDate(d.createdAt.slice(0, 10))} {size(d.size)}{d.tags ? ` · ${d.tags}` : ""}</div>
                </div>
                <div className="flex flex-col">
                  {d.size ? <a href={`${href}?download=1`}><Button size="icon-sm" variant="ghost" aria-label="Télécharger"><Download className="h-4 w-4" /></Button></a> : <a href={href} target="_blank" rel="noreferrer noopener"><Button size="icon-sm" variant="ghost" aria-label="Ouvrir"><ExternalLink className="h-4 w-4" /></Button></a>}
                  <Button size="icon-sm" variant="danger-ghost" onClick={() => remove(d)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {add && <UploadDialog chapters={chapters.data ?? []} defaults={f} onClose={() => { setAdd(false); mutate(); }} />}
    </div>
  );
}

function UploadDialog({ chapters, defaults, onClose }: { chapters: Chapter[]; defaults: Record<string, string>; onClose: () => void }) {
  const refs = useRefs();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [v, setV] = useState({ name: "", url: "", type: "", tags: "", studentId: defaults.studentId, subjectId: defaults.subjectId, levelId: defaults.levelId, chapterId: defaults.chapterId });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    if (file) fd.set("file", file);
    Object.entries(v).forEach(([k, x]) => x && fd.set(k, x));
    try {
      await api("/api/documents", { form: fd });
      toast.success("Document ajouté.");
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); } finally { setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title="Ajouter un document" description="PDF, Word, Excel, PowerPoint, images (10 Mo max.) ou lien externe." footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} loading={busy} disabled={!file && !v.url}>Ajouter</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fichier" className="sm:col-span-2"><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-primary-strong" /></Field>
        <Field label="…ou lien" className="sm:col-span-2"><Input value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Nom (facultatif)"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Type"><Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })} options={DOCUMENT_TYPES} placeholder="Automatique" /></Field>
        <Field label="Élève"><Select value={v.studentId} onChange={(e) => setV({ ...v, studentId: e.target.value })} options={refs.students.map((s) => ({ value: s.id, label: fullName(s) }))} placeholder="—" /></Field>
        <Field label="Matière"><Select value={v.subjectId} onChange={(e) => setV({ ...v, subjectId: e.target.value })} options={refs.subjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="—" /></Field>
        <Field label="Niveau"><Select value={v.levelId} onChange={(e) => setV({ ...v, levelId: e.target.value })} options={refs.levels.map((s) => ({ value: s.id, label: s.name }))} placeholder="—" /></Field>
        <Field label="Chapitre"><Select value={v.chapterId} onChange={(e) => setV({ ...v, chapterId: e.target.value })} options={chapters.map((c) => ({ value: c.id, label: `${c.subject.name} · ${c.title}` }))} placeholder="—" /></Field>
        <Field label="Mots-clés" className="sm:col-span-2"><Input value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} placeholder="révision, trimestre 1…" /></Field>
      </div>
      {err && <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
    </Dialog>
  );
}

export default function DocumentsPage() { return <Suspense><DocsInner /></Suspense>; }
