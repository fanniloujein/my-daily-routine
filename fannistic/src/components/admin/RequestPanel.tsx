"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Send, Trash2, Upload, Undo2 } from "lucide-react";
import { api } from "./api";
import { StatusLine, useStatus } from "./ui";

type StatusKey = "RECEIVED" | "IN_REVIEW" | "INFO_NEEDED" | "QUOTE_SENT" | "QUOTE_ACCEPTED" | "IN_PROGRESS" | "AWAITING_VALIDATION" | "COMPLETED" | "CANCELLED";

export function StatusForm({ id, current, labels, mailOn }: { id: string; current: StatusKey; labels: Record<StatusKey, string>; mailOn: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusKey>(current);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(mailOn);
  const s = useStatus();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await s.run(async () => {
          const r = await api<{ emailSent: boolean }>(`/api/admin/requests/${id}`, "PATCH", { status, note: note || undefined, notify });
          if (notify && !r.emailSent && status !== current) throw new Error("Statut modifié, mais l’e-mail n’a pas pu être envoyé.");
        }, "Statut mis à jour");
        if (ok) setNote("");
        router.refresh();
      }}
    >
      <label htmlFor="st" className="field-label">Statut</label>
      <select id="st" className="input" value={status} onChange={(e) => setStatus(e.target.value as StatusKey)}>
        {(Object.keys(labels) as StatusKey[]).map((k) => <option key={k} value={k}>{labels[k]}</option>)}
      </select>
      <label htmlFor="st-note" className="sr-only">Message au client (facultatif)</label>
      <textarea id="st-note" className="input min-h-[70px]" rows={2} placeholder="Message joint au changement (facultatif, visible dans l’e-mail)" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className={`flex items-center gap-2 text-sm ${mailOn ? "" : "text-ink-muted"}`}>
        <input type="checkbox" className="h-4 w-4 accent-midnight" checked={notify && mailOn} disabled={!mailOn} onChange={(e) => setNotify(e.target.checked)} />
        Prévenir le client par e-mail {!mailOn && "(e-mails non configurés)"}
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-dark btn-sm" disabled={s.busy || status === current}>Mettre à jour</button>
        <StatusLine status={s.status} />
      </div>
    </form>
  );
}

export function NoteForm({ id }: { id: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const s = useStatus();
  return (
    <form
      className="mt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        if (await s.run(() => api(`/api/admin/requests/${id}/notes`, "POST", { body }), "Note ajoutée")) setBody("");
        router.refresh();
      }}
    >
      <label htmlFor="note" className="sr-only">Nouvelle note interne</label>
      <textarea id="note" className="input min-h-[70px]" rows={2} placeholder="Note interne (jamais visible par le client)" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="mt-2 flex items-center gap-3">
        <button type="submit" className="btn-ghost btn-sm" disabled={s.busy || !body.trim()}>Ajouter la note</button>
        <StatusLine status={s.status} />
      </div>
    </form>
  );
}

interface Item {
  label: string;
  quantity: number;
  unitPrice: number; // centimes
}

export interface QuoteDraft {
  id: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";
  items: Item[];
  message: string | null;
  validUntil: string | null;
  currency: string;
}

const euros = (cents: number) => (cents / 100).toFixed(2);

export function QuoteEditor({ requestId, quote, currency, mailOn }: { requestId: string; quote: QuoteDraft | null; currency: string; mailOn: boolean }) {
  const router = useRouter();
  const editable = !quote || quote.status === "DRAFT";
  const [items, setItems] = useState<{ label: string; quantity: string; price: string }[]>(
    quote?.items.map((i) => ({ label: i.label, quantity: String(i.quantity), price: euros(i.unitPrice) })) ?? [{ label: "", quantity: "1", price: "" }],
  );
  const [message, setMessage] = useState(quote?.message ?? "");
  const [validUntil, setValidUntil] = useState(quote?.validUntil?.slice(0, 10) ?? "");
  const [cur, setCur] = useState(quote?.currency ?? currency);
  const s = useStatus();

  const parsed = items
    .filter((i) => i.label.trim())
    .map((i) => ({ label: i.label.trim(), quantity: Math.max(1, parseInt(i.quantity, 10) || 1), unitPrice: Math.round((parseFloat(i.price.replace(",", ".")) || 0) * 100) }));
  const total = parsed.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const fmt = (c: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur }).format(c / 100);

  const send = (action: "save" | "send") =>
    s.run(async () => {
      if (action === "send" && !window.confirm(`Envoyer ce devis de ${fmt(total)} au client ?`)) throw new Error("Envoi annulé.");
      const r = await api<{ emailSent: boolean }>(`/api/admin/requests/${requestId}/quotes`, "POST", {
        quoteId: quote?.status === "DRAFT" ? quote.id : undefined,
        action,
        currency: cur,
        message,
        validUntil,
        items: parsed,
      });
      router.refresh();
      if (action === "send" && mailOn && !r.emailSent) throw new Error("Devis publié dans l’espace client, mais l’e-mail n’a pas pu être envoyé.");
    }, action === "send" ? (mailOn ? "Devis envoyé au client" : "Devis publié dans l’espace de suivi (e-mails non configurés)") : "Brouillon enregistré");

  if (!editable && quote) {
    return (
      <div className="space-y-3 text-sm">
        <ul className="divide-y divide-line rounded-xl border border-line">
          {quote.items.map((i, k) => (
            <li key={k} className="flex justify-between gap-3 px-3 py-2">
              <span>{i.label} × {i.quantity}</span>
              <span className="font-medium">{new Intl.NumberFormat("fr-FR", { style: "currency", currency: quote.currency }).format((i.unitPrice * i.quantity) / 100)}</span>
            </li>
          ))}
        </ul>
        {quote.status === "SENT" && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() =>
                s.run(async () => {
                  if (!window.confirm("Retirer ce devis pour le modifier ? Le client ne pourra plus y répondre.")) throw new Error("Annulé.");
                  await api(`/api/admin/requests/${requestId}/quotes`, "POST", { quoteId: quote.id, action: "withdraw" });
                  router.refresh();
                }, "Devis retiré")
              }
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" /> Retirer pour modifier
            </button>
            <StatusLine status={s.status} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_110px_auto] gap-2">
            <input className="input" aria-label={`Ligne ${i + 1} : prestation`} placeholder="Prestation" value={it.label} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <input className="input" aria-label={`Ligne ${i + 1} : quantité`} inputMode="numeric" value={it.quantity} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
            <input className="input" aria-label={`Ligne ${i + 1} : prix unitaire`} inputMode="decimal" placeholder="0,00" value={it.price} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
            <button type="button" className="rounded-lg px-2 text-ink-muted hover:text-danger" aria-label={`Supprimer la ligne ${i + 1}`} onClick={() => setItems(items.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button type="button" className="btn-ghost btn-sm" onClick={() => setItems([...items, { label: "", quantity: "1", price: "" }])}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter une ligne
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="q-valid" className="field-label">Valable jusqu’au</label>
          <input id="q-valid" type="date" className="input" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <div>
          <label htmlFor="q-cur" className="field-label">Devise</label>
          <input id="q-cur" className="input uppercase" maxLength={3} value={cur} onChange={(e) => setCur(e.target.value.toUpperCase())} />
        </div>
      </div>
      <div>
        <label htmlFor="q-msg" className="field-label">Message au client</label>
        <textarea id="q-msg" className="input" rows={4} placeholder="Périmètre, délais, nombre de révisions, modalités de paiement…" value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <p className="text-right text-lg font-bold">Total : {fmt(total)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost btn-sm" disabled={s.busy} onClick={() => send("save")}>Enregistrer le brouillon</button>
        <button type="button" className="btn-primary btn-sm" disabled={s.busy || !parsed.length} onClick={() => send("send")}>
          <Send className="h-4 w-4" aria-hidden="true" /> Envoyer au client
        </button>
        <StatusLine status={s.status} />
      </div>
    </div>
  );
}

export function TeamMessageForm({ id, mailOn }: { id: string; mailOn: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notify, setNotify] = useState(mailOn);
  const s = useStatus();
  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData();
        form.set("body", body);
        if (notify && mailOn) form.set("notify", "1");
        files.forEach((f) => form.append("files", f));
        const ok = await s.run(async () => {
          const r = await api<{ emailSent: boolean }>(`/api/admin/requests/${id}/messages`, "POST", form);
          if (notify && mailOn && !r.emailSent) throw new Error("Message publié, mais l’e-mail n’a pas pu être envoyé.");
        }, "Message envoyé");
        if (ok) {
          setBody("");
          setFiles([]);
        }
        router.refresh();
      }}
    >
      <label htmlFor="tm" className="sr-only">Message au client</label>
      <textarea id="tm" className="input" rows={3} placeholder="Écrire au client…" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-ghost btn-sm cursor-pointer">
          <Upload className="h-4 w-4" aria-hidden="true" /> Joindre {files.length ? `(${files.length})` : ""}
          <input type="file" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} />
        </label>
        <label className={`flex items-center gap-2 text-sm ${mailOn ? "" : "text-ink-muted"}`}>
          <input type="checkbox" className="h-4 w-4 accent-midnight" checked={notify && mailOn} disabled={!mailOn} onChange={(e) => setNotify(e.target.checked)} />
          Prévenir par e-mail
        </label>
        <button type="submit" className="btn-dark btn-sm ms-auto" disabled={s.busy || (!body.trim() && !files.length)}>Envoyer</button>
      </div>
      <StatusLine status={s.status} />
    </form>
  );
}

export function DeliverableUpload({ id }: { id: string }) {
  const router = useRouter();
  const s = useStatus();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <label className="btn-ghost btn-sm cursor-pointer">
        <Upload className="h-4 w-4" aria-hidden="true" /> Déposer des fichiers livrés
        <input
          type="file"
          multiple
          className="sr-only"
          onChange={async (e) => {
            const list = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (!list.length) return;
            const form = new FormData();
            list.forEach((f) => form.append("files", f));
            await s.run(() => api(`/api/admin/requests/${id}/files`, "POST", form), "Fichiers déposés");
            router.refresh();
          }}
        />
      </label>
      <StatusLine status={s.status} />
    </div>
  );
}

export function DeleteFileButton({ fileId, name }: { fileId: string; name: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded p-1 text-ink-muted hover:text-danger"
      aria-label={`Supprimer ${name}`}
      onClick={async () => {
        if (!window.confirm(`Supprimer « ${name} » ?`)) return;
        await api(`/api/admin/files/${fileId}`, "DELETE").catch(() => null);
        router.refresh();
      }}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

export function DeleteRequestButton({ id, reference }: { id: string; reference: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-ghost btn-sm text-danger"
      onClick={async () => {
        const typed = window.prompt(`Suppression définitive (données, fichiers, messages). Tapez ${reference} pour confirmer.`);
        if (typed !== reference) return;
        await api(`/api/admin/requests/${id}`, "DELETE").catch(() => null);
        router.push("/admin/demandes");
        router.refresh();
      }}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" /> Supprimer la demande
    </button>
  );
}
