"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Card, ErrorBox, Field, Loading, Modal, Notice, PageHeader, Segmented, useUi } from "@/components/ui";
import { CategoryBadge, CategoryIcon } from "@/components/Icon";
import { ApiError, api, cx, refreshAll } from "@/lib/client";
import { useCategories, type CategoryT } from "@/lib/hooks";
import { CATEGORY_ICONS, COLOR_PALETTE } from "@/lib/constants";

const BALANCE: Record<string, string> = { work: "Travail", rest: "Repos", health: "Santé", personal: "Personnel" };

export default function CategoriesPage() {
  const { data, error, mutate } = useCategories();
  const { toast } = useUi();
  const [form, setForm] = useState<Partial<CategoryT> | null>(null);
  const [del, setDel] = useState<CategoryT | null>(null);
  const [drag, setDrag] = useState<string | null>(null);

  async function reorder(ids: string[]) {
    mutate(ids.map((id) => data!.find((c) => c.id === id)!), false);
    await api("/api/categories/reorder", { body: { ids } });
    await refreshAll();
  }
  function move(i: number, dir: -1 | 1) {
    const ids = data!.map((c) => c.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder(ids);
  }

  return (
    <div>
      <PageHeader
        title="Catégories"
        subtitle="Crée, renomme, réorganise. Aucune activité n'est perdue à la suppression."
        actions={
          <Button onClick={() => setForm({})}>
            <Plus className="h-4 w-4" /> Catégorie
          </Button>
        }
      />
      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <Card>
          <ul className="divide-y divide-line/60">
            {data.map((c, i) => (
              <li
                key={c.id}
                draggable
                onDragStart={() => setDrag(c.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (!drag || drag === c.id) return;
                  const ids = data.map((x) => x.id).filter((id) => id !== drag);
                  ids.splice(i, 0, drag);
                  setDrag(null);
                  reorder(ids);
                }}
                className={cx("flex items-center gap-3 py-2.5", drag === c.id && "opacity-50")}
              >
                <GripVertical className="hidden h-4 w-4 cursor-grab text-muted sm:block" />
                <CategoryBadge category={c} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{c.name}</div>
                  <div className="text-xs text-muted">
                    {BALANCE[c.balance]} · {c.activityCount} activité(s)
                    {c.reminderMinutes != null ? ` · rappel ${c.reminderMinutes === 0 ? "à l'heure" : `${c.reminderMinutes} min avant`}` : ""}
                  </div>
                </div>
                <div className="flex items-center">
                  <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Monter">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === data.length - 1} aria-label="Descendre">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setForm(c)} aria-label="Modifier">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-danger" onClick={() => setDel(c)} aria-label="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {form && <CategoryForm initial={form} onClose={() => setForm(null)} onSaved={() => { mutate(); toast("Catégorie enregistrée"); }} />}
      {del && data && <DeleteCategory c={del} others={data.filter((x) => x.id !== del.id)} onClose={() => setDel(null)} />}
    </div>
  );
}

function CategoryForm({ initial, onClose, onSaved }: { initial: Partial<CategoryT>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({
    name: initial.name ?? "",
    color: initial.color ?? COLOR_PALETTE[0],
    icon: initial.icon ?? "tag",
    balance: (initial.balance ?? "personal") as "work" | "rest" | "health" | "personal",
    reminderMinutes: initial.reminderMinutes ?? null,
  });
  async function save() {
    if (!f.name.trim()) return toast("Nom requis", "danger");
    try {
      if (initial.id) await api(`/api/categories/${initial.id}`, { method: "PATCH", body: f });
      else await api("/api/categories", { body: f });
      await refreshAll();
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }
  return (
    <Modal open onClose={onClose} title={initial.id ? "Modifier la catégorie" : "Nouvelle catégorie"} footer={<Button onClick={save}>Enregistrer</Button>}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CategoryBadge category={f} />
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nom de la catégorie" maxLength={60} />
        </div>
        <div>
          <span className="label">Couleur</span>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_PALETTE.map((c) => (
              <button key={c} type="button" onClick={() => setF({ ...f, color: c })} className={cx("h-7 w-7 rounded-full ring-offset-2 ring-offset-surface", f.color === c && "ring-2 ring-ink")} style={{ background: c }} aria-label={c} />
            ))}
            <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-7 w-10 cursor-pointer rounded border border-line bg-transparent" aria-label="Couleur personnalisée" />
          </div>
        </div>
        <div>
          <span className="label">Icône</span>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-11">
            {CATEGORY_ICONS.map((ic) => (
              <button key={ic} type="button" onClick={() => setF({ ...f, icon: ic })} className={cx("flex h-9 items-center justify-center rounded-lg", f.icon === ic ? "bg-primary-soft text-primary-strong" : "bg-surface-2 text-ink-2")} aria-label={ic}>
                <CategoryIcon name={ic} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Compte comme (équilibre travail / repos)</span>
          <Segmented value={f.balance} onChange={(v) => setF({ ...f, balance: v })} options={Object.entries(BALANCE).map(([value, label]) => ({ value: value as typeof f.balance, label }))} />
        </div>
        <Field label="Rappel par défaut" hint="Proposé automatiquement pour les nouvelles activités de cette catégorie">
          <select className="input" value={f.reminderMinutes ?? ""} onChange={(e) => setF({ ...f, reminderMinutes: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">Aucun</option>
            {[0, 5, 10, 15, 30, 60, 120].map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "À l'heure" : `${m} min avant`}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function DeleteCategory({ c, others, onClose }: { c: CategoryT; others: CategoryT[]; onClose: () => void }) {
  const { toast } = useUi();
  const [target, setTarget] = useState(others.find((o) => o.kind === "other")?.id ?? others[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  async function del() {
    setLoading(true);
    try {
      const r = await api<{ reassigned: number }>(`/api/categories/${c.id}${c.activityCount ? `?reassignTo=${target}` : ""}`, { method: "DELETE" });
      await refreshAll();
      toast(r.reassigned ? `Catégorie supprimée, ${r.reassigned} activité(s) réaffectée(s)` : "Catégorie supprimée");
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erreur", "danger");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Supprimer « ${c.name} » ?`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="danger" onClick={del} loading={loading} disabled={c.activityCount > 0 && !target}>
            Supprimer
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {c.activityCount > 0 ? (
          <>
            <Notice tone="warning">Cette catégorie contient {c.activityCount} activité(s). Elles seront déplacées vers :</Notice>
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p className="text-ink-2">Aucune activité n&apos;utilise cette catégorie.</p>
        )}
        {c.kind && <p className="text-xs text-muted">C&apos;est une catégorie utilisée par un module : elle sera recréée automatiquement si le module en a besoin.</p>}
      </div>
    </Modal>
  );
}
