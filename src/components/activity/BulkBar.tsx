"use client";

import { useState } from "react";
import { CalendarArrowUp, Check, SkipForward, Trash2, X } from "lucide-react";
import { Button, useUi } from "@/components/ui";
import { api, refreshAll } from "@/lib/client";
import { addDays, today } from "@/lib/dates";
import type { Occurrence } from "@/lib/hooks";

/** Barre d'actions groupées : terminer, reporter, déplacer ou supprimer plusieurs activités. */
export function BulkBar({ selected, all, onChange }: { selected: Occurrence[]; all: Occurrence[]; onChange: (keys: Set<string>) => void }) {
  const { toast, confirm } = useUi();
  const [date, setDate] = useState(addDays(today(), 1));
  const [busy, setBusy] = useState(false);
  const items = selected.map((o) => ({ id: o.id, date: o.originalDate }));

  async function run(action: "delete" | "postpone" | "move" | "done") {
    if (!items.length) return;
    if (action === "delete") {
      const fixed = selected.filter((o) => o.isFixed).length;
      const ok = await confirm({
        title: `Supprimer ${items.length} activité(s) ?`,
        message: `${fixed ? `Dont ${fixed} rendez-vous fixe(s). ` : ""}Pour les activités récurrentes, seule l'occurrence sélectionnée est supprimée. Cette action est définitive.`,
        danger: true,
        confirmLabel: "Supprimer",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await api<{ count: number }>("/api/activities/bulk", { body: { action, items, toDate: action === "move" ? date : undefined } });
      await refreshAll();
      onChange(new Set());
      toast(
        action === "delete" ? `${r.count} activité(s) supprimée(s)` : action === "done" ? `${r.count} activité(s) terminée(s) 🌿` : action === "postpone" ? `${r.count} activité(s) reportée(s)` : `${r.count} activité(s) déplacée(s)`,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary-soft/90 p-2 backdrop-blur lg:top-2">
      <span className="px-2 text-sm font-medium text-primary-strong">{selected.length} sélectionnée(s)</span>
      <Button size="sm" variant="ghost" onClick={() => onChange(new Set(selected.length === all.length ? [] : all.map((o) => o.key)))}>
        {selected.length === all.length ? "Tout désélectionner" : "Tout sélectionner"}
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="success" disabled={!items.length || busy} onClick={() => run("done")}>
          <Check className="h-3.5 w-3.5" /> Terminer
        </Button>
        <Button size="sm" variant="secondary" disabled={!items.length || busy} onClick={() => run("postpone")}>
          <SkipForward className="h-3.5 w-3.5" /> Reporter
        </Button>
        <input type="date" className="input h-8 w-36 py-0 text-xs" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date de destination" />
        <Button size="sm" variant="secondary" disabled={!items.length || busy} onClick={() => run("move")}>
          <CalendarArrowUp className="h-3.5 w-3.5" /> Déplacer
        </Button>
        <Button size="sm" variant="danger" disabled={!items.length || busy} onClick={() => run("delete")}>
          <Trash2 className="h-3.5 w-3.5" /> Supprimer
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onChange(new Set())} aria-label="Annuler la sélection">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function SelectBox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 cursor-pointer accent-[rgb(var(--primary))]" aria-label="Sélectionner" />;
}
