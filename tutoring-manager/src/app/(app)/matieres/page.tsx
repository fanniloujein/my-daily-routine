"use client";
import { useState } from "react";
import { GraduationCap, Pencil, Plus, Shapes, Trash2 } from "lucide-react";
import { api, refreshAll, useApi } from "@/lib/client";
import { COLORS, LEVEL_CYCLES } from "@/lib/constants";
import { formatMinutes } from "@/lib/dates";
import { formatDT } from "@/lib/money";
import type { Level, Subject } from "@/lib/types";
import { Badge, Button, Card, ColorPicker, Dialog, Field, Input, Loading, PageHeader, Select, Textarea, useConfirm, useToast } from "@/components/ui";

export default function SubjectsPage() {
  const subjects = useApi<Subject[]>("/api/subjects");
  const levels = useApi<Level[]>("/api/levels");
  const toast = useToast();
  const confirm = useConfirm();
  const [editS, setEditS] = useState<Subject | "new" | null>(null);
  const [editL, setEditL] = useState<Level | "new" | null>(null);

  const delSubject = async (s: Subject) => {
    if ((await confirm({ title: `Supprimer « ${s.name} » ?`, text: "Si la matière est utilisée (élèves, séances, chapitres), elle sera archivée au lieu d'être supprimée.", danger: true })) === false) return;
    const r = await api<{ archived?: boolean }>(`/api/subjects/${s.id}`, { method: "DELETE" });
    toast.success(r.archived ? "Matière archivée (utilisée ailleurs)." : "Matière supprimée.");
    refreshAll();
  };
  const delLevel = async (l: Level) => {
    if ((await confirm({ title: `Supprimer « ${l.name} » ?`, danger: true })) === false) return;
    try {
      await api(`/api/levels/${l.id}`, { method: "DELETE" });
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Matières & niveaux" icon={<Shapes className="h-5 w-5" />} subtitle="Personnalisez les matières enseignées et les niveaux scolaires." />
      <Card title="Matières" icon={<Shapes className="h-4 w-4" />} action={<Button size="sm" onClick={() => setEditS("new")}><Plus className="h-4 w-4" />Matière</Button>}>
        {!subjects.data ? <Loading /> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {subjects.data.map((s) => (
              <div key={s.id} className={`rounded-2xl border border-line p-4 ${s.archived ? "opacity-60" : ""}`} style={{ borderLeft: `6px solid ${s.color}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{s.name} {s.archived && <Badge>archivée</Badge>}</div>
                    {s.description && <div className="text-xs text-muted">{s.description}</div>}
                  </div>
                  <div className="flex">
                    <Button size="icon-sm" variant="ghost" onClick={() => setEditS(s)} aria-label="Modifier"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon-sm" variant="danger-ghost" onClick={() => delSubject(s)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted">{s.defaultRate != null ? `${formatDT(Number(s.defaultRate))} · ` : ""}{formatMinutes(s.defaultDuration)} · {s._count?.students ?? 0} élève(s) · {s._count?.sessions ?? 0} séance(s)</div>
                {s.levels && s.levels.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{s.levels.map((l) => <Badge key={l.id}>{l.name}</Badge>)}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Niveaux scolaires" icon={<GraduationCap className="h-4 w-4" />} action={<Button size="sm" onClick={() => setEditL("new")}><Plus className="h-4 w-4" />Niveau</Button>}>
        {!levels.data ? <Loading /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(LEVEL_CYCLES).map(([cycle, label]) => (
              <div key={cycle}>
                <h3 className="section-title mb-2">{label}</h3>
                <ul className="space-y-1">
                  {levels.data!.filter((l) => l.cycle === cycle).map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2/60">
                      <span>{l.name} <span className="text-xs text-muted">({l._count?.students ?? 0})</span></span>
                      <span className="flex">
                        <Button size="icon-sm" variant="ghost" onClick={() => setEditL(l)} aria-label="Modifier"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon-sm" variant="danger-ghost" onClick={() => delLevel(l)} aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
      {editS && <SubjectDialog subject={editS === "new" ? null : editS} levels={levels.data ?? []} onClose={() => { setEditS(null); refreshAll(); }} />}
      {editL && <LevelDialog level={editL === "new" ? null : editL} onClose={() => { setEditL(null); refreshAll(); }} />}
    </div>
  );
}

function SubjectDialog({ subject, levels, onClose }: { subject: Subject | null; levels: Level[]; onClose: () => void }) {
  const [v, setV] = useState({ name: subject?.name ?? "", description: subject?.description ?? "", color: subject?.color ?? COLORS[0], defaultRate: subject?.defaultRate != null ? String(subject.defaultRate) : "", defaultDuration: String(subject?.defaultDuration ?? 60), levelIds: subject?.levels?.map((l) => l.id) ?? [], archived: subject?.archived ?? false });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try {
      const body = { ...v, defaultRate: v.defaultRate === "" ? null : Number(v.defaultRate), defaultDuration: Number(v.defaultDuration) };
      await api(subject ? `/api/subjects/${subject.id}` : "/api/subjects", { method: subject ? "PUT" : "POST", body });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  };
  return (
    <Dialog open onClose={onClose} title={subject ? "Modifier la matière" : "Nouvelle matière"} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} disabled={!v.name.trim()}>Enregistrer</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" required><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Couleur d'identification"><ColorPicker value={v.color} onChange={(color) => setV({ ...v, color })} colors={COLORS} /></Field>
        <Field label="Tarif habituel (DT)"><Input type="number" min={0} value={v.defaultRate} onChange={(e) => setV({ ...v, defaultRate: e.target.value })} /></Field>
        <Field label="Durée habituelle (min)"><Input type="number" min={15} step={15} value={v.defaultDuration} onChange={(e) => setV({ ...v, defaultDuration: e.target.value })} /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <Field label="Niveaux concernés" className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {levels.map((l) => (
              <button key={l.id} type="button" onClick={() => setV({ ...v, levelIds: v.levelIds.includes(l.id) ? v.levelIds.filter((x) => x !== l.id) : [...v.levelIds, l.id] })} className={`chip border px-2.5 py-1 ${v.levelIds.includes(l.id) ? "border-primary-strong bg-primary-soft text-primary-strong" : "border-line text-muted"}`}>{l.name}</button>
            ))}
          </div>
        </Field>
        {subject?.archived && <Button variant="soft" onClick={() => setV({ ...v, archived: false })}>Réactiver la matière</Button>}
      </div>
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
    </Dialog>
  );
}

function LevelDialog({ level, onClose }: { level: Level | null; onClose: () => void }) {
  const [v, setV] = useState({ name: level?.name ?? "", cycle: level?.cycle ?? "OTHER", order: level?.order ?? 0 });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try {
      await api(level ? `/api/levels/${level.id}` : "/api/levels", { method: level ? "PUT" : "POST", body: v });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  };
  return (
    <Dialog open onClose={onClose} size="sm" title={level ? "Modifier le niveau" : "Nouveau niveau"} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} disabled={!v.name.trim()}>Enregistrer</Button></>}>
      <div className="grid gap-3">
        <Field label="Nom"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ex. 4ème année Sciences" /></Field>
        <Field label="Cycle"><Select value={v.cycle} onChange={(e) => setV({ ...v, cycle: e.target.value })} options={LEVEL_CYCLES} /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
    </Dialog>
  );
}
