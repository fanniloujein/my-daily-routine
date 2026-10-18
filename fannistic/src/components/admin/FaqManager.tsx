"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "./api";
import { L10nField, StatusLine, Toggle, useStatus } from "./ui";

type L = { fr: string; en: string; ar: string };
export interface FaqRow {
  id?: string;
  question: L;
  answer: L;
  order: number;
  published: boolean;
}

function FaqCard({ initial, onDone }: { initial: FaqRow; onDone: () => void }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const st = useStatus();
  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-5">
        <Toggle checked={f.published} onChange={(v) => setF({ ...f, published: v })} label="Publiée" />
        <div className="flex items-center gap-2">
          <label htmlFor={`fo-${f.id ?? "new"}`} className="text-sm">Ordre</label>
          <input id={`fo-${f.id ?? "new"}`} type="number" min={0} className="input w-20" value={f.order} onChange={(e) => setF({ ...f, order: Number(e.target.value) || 0 })} />
        </div>
      </div>
      <L10nField label="Question" required value={f.question} onChange={(v) => setF({ ...f, question: v })} />
      <L10nField label="Réponse" required multiline value={f.answer} onChange={(v) => setF({ ...f, answer: v })} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={st.busy}
          onClick={async () => {
            const body = { question: f.question, answer: f.answer, order: f.order, published: f.published };
            const ok = await st.run(() => (f.id ? api(`/api/admin/faq/${f.id}`, "PUT", body) : api("/api/admin/faq", "POST", body)));
            if (ok) {
              router.refresh();
              if (!f.id) onDone();
            }
          }}
        >
          Enregistrer
        </button>
        {f.id ? (
          <button
            type="button"
            className="btn-ghost btn-sm text-danger"
            onClick={async () => {
              if (!window.confirm("Supprimer cette question ?")) return;
              await api(`/api/admin/faq/${f.id}`, "DELETE");
              router.refresh();
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Supprimer
          </button>
        ) : (
          <button type="button" className="btn-ghost btn-sm" onClick={onDone}>Annuler</button>
        )}
        <StatusLine status={st.status} />
      </div>
    </div>
  );
}

export function FaqManager({ items }: { items: FaqRow[] }) {
  const [adding, setAdding] = useState(false);
  const empty = { fr: "", en: "", ar: "" };
  return (
    <div className="space-y-4">
      {items.map((f) => <FaqCard key={f.id} initial={f} onDone={() => undefined} />)}
      {adding ? (
        <FaqCard initial={{ question: empty, answer: empty, order: items.length, published: true }} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" className="btn-dark btn-sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter une question
        </button>
      )}
    </div>
  );
}
