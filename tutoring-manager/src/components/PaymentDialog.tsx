"use client";
import { useEffect, useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { api, fullName, refreshAll, useApi } from "@/lib/client";
import { PAYMENT_METHODS } from "@/lib/constants";
import { shortDate, today } from "@/lib/dates";
import { formatDT, fromMil, toMil } from "@/lib/money";
import { BILLING_MODES } from "@/lib/finance";
import type { Finance, Invoice } from "@/lib/types";
import { Button, Checkbox, Dialog, Field, Input, Segmented, Select, Textarea, useToast } from "./ui";
import { useRefs } from "./shared";

type Detail = { id: string; firstName: string; lastName: string; billingMode: string; rate: number; finance: Finance; invoices: Invoice[] };
export type PaymentKind = "PAYMENT" | "ADVANCE" | "DISCOUNT";

export function PaymentDialog({ open, onClose, studentId: initial, kind: initialKind = "PAYMENT" }: { open: boolean; onClose: () => void; studentId?: string; kind?: PaymentKind }) {
  const refs = useRefs();
  const toast = useToast();
  const [studentId, setStudentId] = useState(initial ?? "");
  const [kind, setKind] = useState<PaymentKind>(initialKind);
  const [v, setV] = useState({ date: today(), amount: "", method: "CASH", reason: "", reference: "", notes: "" });
  const [targets, setTargets] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; receiptNo: string | null } | null>(null);
  const { data: st } = useApi<Detail>(open && studentId ? `/api/students/${studentId}` : null);

  useEffect(() => {
    if (!open) return;
    setStudentId(initial ?? "");
    setKind(initialKind);
    setV({ date: today(), amount: "", method: "CASH", reason: "", reference: "", notes: "" });
    setTargets([]);
    setError(null);
    setDone(null);
  }, [open, initial, initialKind]);

  const unpaid = useMemo(() => (st?.invoices ?? []).filter((i) => i.state && i.state.remaining > 0).sort((a, b) => (a.date < b.date ? -1 : 1)), [st]);
  const targetSum = unpaid.filter((i) => targets.includes(i.id)).reduce((a, i) => a + toMil(i.state!.remaining), 0);
  useEffect(() => {
    if (targets.length) setV((c) => ({ ...c, amount: String(fromMil(targetSum)) }));
  }, [targets.length, targetSum]);

  // Aperçu de la situation après le versement
  const amount = toMil(v.amount || 0);
  const due = toMil(st?.finance.due ?? 0), credit = toMil(st?.finance.credit ?? 0);
  const newDue = Math.max(0, due - amount);
  const newCredit = kind === "DISCOUNT" ? credit : credit + Math.max(0, amount - due);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const p = await api<{ id: string; receiptNo: string | null }>("/api/payments", { body: { studentId, kind, ...v, amount: Number(v.amount), targetInvoiceIds: targets } });
      toast.success(kind === "ADVANCE" ? "Avance enregistrée et ajoutée au crédit." : kind === "DISCOUNT" ? "Remise enregistrée." : "Paiement enregistré.");
      await refreshAll();
      setDone(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (done)
    return (
      <Dialog open={open} onClose={onClose} size="sm" title="Versement enregistré" footer={<Button onClick={onClose}>Terminer</Button>}>
        <p className="text-sm text-ink-2">Le journal financier et la situation de l&apos;élève ont été mis à jour automatiquement.</p>
        {done.receiptNo && (
          <a href={`/api/payments/${done.id}/receipt`} target="_blank" rel="noreferrer" className="mt-4 inline-block">
            <Button variant="soft"><FileDown className="h-4 w-4" />Télécharger le reçu {done.receiptNo}</Button>
          </a>
        )}
      </Dialog>
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="Enregistrer un versement"
      description="Paiement, avance ou remise — affecté automatiquement aux séances dues."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} loading={saving} disabled={!studentId || !(Number(v.amount) > 0)}>Enregistrer {v.amount ? formatDT(Number(v.amount)) : ""}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Élève" required>
          <Select value={studentId} onChange={(e) => { setStudentId(e.target.value); setTargets([]); }} options={refs.students.map((s) => ({ value: s.id, label: fullName(s) }))} placeholder="Choisir un élève…" disabled={!!initial} />
        </Field>
        {st && (
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-2/60 p-3 text-center text-xs">
            <div><div className="text-muted">Reste à payer</div><div className={`mt-0.5 text-base font-semibold ${due > 0 ? "text-danger" : ""}`}>{formatDT(fromMil(due))}</div></div>
            <div><div className="text-muted">Crédit disponible</div><div className="mt-0.5 text-base font-semibold text-primary-strong">{formatDT(fromMil(credit))}</div></div>
            <div><div className="text-muted">Mode</div><div className="mt-0.5 font-medium">{BILLING_MODES[st.billingMode as keyof typeof BILLING_MODES]}</div></div>
          </div>
        )}
        <Segmented<PaymentKind>
          value={kind}
          onChange={(k) => { setKind(k); if (k !== "PAYMENT") setTargets([]); }}
          options={[{ value: "PAYMENT", label: "Paiement" }, { value: "ADVANCE", label: "Avance" }, { value: "DISCOUNT", label: "Remise" }]}
        />
        <p className="text-xs text-muted">
          {kind === "PAYMENT" && "Règle les séances dues (les plus anciennes d'abord, ou celles que vous cochez). Un éventuel surplus devient du crédit."}
          {kind === "ADVANCE" && "Versement avant les séances : il règle d'abord une éventuelle dette, le reste devient du crédit consommé automatiquement à chaque séance effectuée. Il n'est compté en revenu qu'une fois consommé."}
          {kind === "DISCOUNT" && "Réduction accordée (geste, séance offerte) : diminue le reste à payer sans être un encaissement."}
        </p>
        {kind === "PAYMENT" && unpaid.length > 0 && (
          <div className="rounded-2xl border border-line p-3">
            <div className="mb-2 text-xs font-medium text-muted">Paiement groupé : cochez les séances réglées (facultatif)</div>
            <div className="max-h-44 space-y-1.5 overflow-y-auto">
              {unpaid.map((i) => (
                <Checkbox
                  key={i.id}
                  checked={targets.includes(i.id)}
                  onChange={(b) => setTargets(b ? [...targets, i.id] : targets.filter((x) => x !== i.id))}
                  label={<span className="text-sm">{i.label} — <b>{formatDT(i.state!.remaining)}</b>{i.state!.status === "PARTIAL" && <span className="text-muted"> (reste)</span>}</span>}
                />
              ))}
            </div>
            {unpaid.length > 1 && <Button size="sm" variant="ghost" className="mt-2" onClick={() => setTargets(targets.length === unpaid.length ? [] : unpaid.map((i) => i.id))}>{targets.length === unpaid.length ? "Tout décocher" : "Tout régler"}</Button>}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Montant (DT)" required><Input type="number" inputMode="decimal" min={0} step="0.001" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
          <Field label="Date" required><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
          {kind !== "DISCOUNT" && <Field label="Mode de paiement"><Select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })} options={PAYMENT_METHODS} /></Field>}
          <Field label="Référence"><Input value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} placeholder="N° de virement…" /></Field>
          <Field label="Motif" className="sm:col-span-2"><Input value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} placeholder={kind === "ADVANCE" ? "Avance pour 4 séances" : "Séances de novembre"} /></Field>
          <Field label="Remarque" className="sm:col-span-2"><Textarea rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
        </div>
        {st && amount > 0 && (
          <div className="rounded-xl bg-success-soft/70 px-3 py-2 text-sm text-ink">
            Après ce versement : reste à payer <b>{formatDT(fromMil(newDue))}</b> · crédit disponible <b>{formatDT(fromMil(newCredit))}</b>
            {unpaid[0] && due > 0 && <span className="block text-xs text-muted">Plus ancienne séance due : {shortDate(unpaid[0].date)}</span>}
          </div>
        )}
        {st && amount > due + toMil(st.rate) * 20 && (
          <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-ink">⚠ Montant inhabituel : il dépasse largement le reste à payer. Vérifiez la saisie avant d&apos;enregistrer.</p>
        )}
        {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
