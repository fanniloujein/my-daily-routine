"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, Modal, Notice, Segmented, Toggle, useUi } from "./ui";
import { api, refreshAll } from "@/lib/client";
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS } from "@/lib/constants";

export type Project = {
  id: string;
  client: string;
  name: string;
  description: string | null;
  deadline: string | null;
  budget: number | null;
  status: "PROSPECT" | "ACTIVE" | "ON_HOLD" | "DONE";
  priority: number;
  nextAction: string | null;
  notes: string | null;
  links: { label: string; url: string }[];
};

export function ProjectForm({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial?: Project; onSaved?: (id: string) => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({
    client: initial?.client ?? "",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    deadline: initial?.deadline ?? "",
    budget: initial?.budget != null ? String(initial.budget) : "",
    status: initial?.status ?? "ACTIVE",
    priority: initial?.priority ?? 2,
    nextAction: initial?.nextAction ?? "",
    notes: initial?.notes ?? "",
    links: initial?.links ?? [],
    template: !initial,
  });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setErr(null);
    if (!f.client.trim() || !f.name.trim()) return setErr("Client et nom du projet sont obligatoires.");
    setSaving(true);
    try {
      const body = { ...f, budget: f.budget === "" ? null : Number(f.budget), deadline: f.deadline || null, links: f.links.filter((l) => l.url) };
      const r = initial ? await api<{ id: string }>(`/api/projects/${initial.id}`, { method: "PATCH", body }) : await api<{ id: string }>("/api/projects", { body });
      await refreshAll();
      toast(initial ? "Projet mis à jour" : "Projet créé 🚀");
      onSaved?.(r.id);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Modifier le projet" : "Nouveau projet"} size="lg" footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} loading={saving}>Enregistrer</Button></>}>
      <div className="space-y-3">
        {err && <Notice tone="danger">{err}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Client">
            <input className="input" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} />
          </Field>
          <Field label="Nom du projet">
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
        </div>
        <Field label="Description">
          <textarea className="input min-h-[60px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date limite">
            <input type="date" className="input" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
          </Field>
          <Field label="Budget (€, facultatif)">
            <input type="number" min={0} className="input" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
          </Field>
        </div>
        <div>
          <span className="label">Statut</span>
          <Segmented value={f.status} onChange={(v) => setF({ ...f, status: v })} options={Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value: value as Project["status"], label }))} />
        </div>
        <div>
          <span className="label">Priorité</span>
          <Segmented value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={[1, 2, 3, 4].map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
        </div>
        <Field label="Prochaine action">
          <input className="input" value={f.nextAction} onChange={(e) => setF({ ...f, nextAction: e.target.value })} placeholder="Envoyer la maquette au client" />
        </Field>
        <Field label="Notes">
          <textarea className="input min-h-[60px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <div>
          <span className="label">Liens utiles</span>
          <div className="space-y-2">
            {f.links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input className="input h-9 w-1/3" placeholder="Libellé" value={l.label} onChange={(e) => setF({ ...f, links: f.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <input className="input h-9 flex-1" placeholder="https://…" value={l.url} onChange={(e) => setF({ ...f, links: f.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                <Button size="icon" variant="ghost" onClick={() => setF({ ...f, links: f.links.filter((_, j) => j !== i) })} aria-label="Retirer">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setF({ ...f, links: [...f.links, { label: "", url: "" }] })}>
              <Plus className="h-4 w-4" /> Ajouter un lien
            </Button>
          </div>
        </div>
        {!initial && (
          <Toggle checked={f.template} onChange={(v) => setF({ ...f, template: v })} label="Utiliser le modèle « site web »" description="Analyser, concevoir, frontend, backend, tests, corrections, déploiement" />
        )}
      </div>
    </Modal>
  );
}
