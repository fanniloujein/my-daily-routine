"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Ban, ChevronLeft, ChevronRight, FileDown, ReceiptText } from "lucide-react";
import { api, fullName, qsOf, refreshAll, useApi } from "@/lib/client";
import { PAYMENT_KINDS, PAYMENT_METHODS, TX_TYPES } from "@/lib/constants";
import { shortDate } from "@/lib/dates";
import { formatDT } from "@/lib/money";
import type { Payment, Tx } from "@/lib/types";
import { Badge, Button, Empty, ErrorBox, Input, Loading, PageHeader, Select, Tabs, useConfirm, useToast } from "@/components/ui";
import { Money, TxBadge, useRefs } from "@/components/shared";

const SIZE = 50;

export default function JournalPage() {
  const refs = useRefs();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<"journal" | "versements">("journal");
  const [f, setF] = useState({ studentId: "", type: "", from: "", to: "", method: "" });
  const [page, setPage] = useState(0);
  const tx = useApi<{ items: Tx[]; total: number }>(tab === "journal" ? `/api/transactions${qsOf({ studentId: f.studentId, type: f.type, from: f.from, to: f.to, take: SIZE, skip: page * SIZE })}` : null);
  const pays = useApi<Payment[]>(tab === "versements" ? `/api/payments${qsOf({ studentId: f.studentId, kind: f.type, method: f.method, from: f.from, to: f.to, voided: 1 })}` : null);
  const pages = Math.ceil((tx.data?.total ?? 0) / SIZE);
  const up = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPage(0); };
  const voidIt = async (p: Payment) => {
    const reason = await confirm({ title: "Annuler ce versement ?", text: `${p.student ? fullName(p.student) : ""} — ${formatDT(Number(p.amount))} du ${shortDate(p.date)}`, danger: true, reason: "Motif de l'annulation", confirm: "Annuler le versement" });
    if (reason === false) return;
    await api(`/api/payments/${p.id}/void`, { body: { reason } });
    toast.success("Versement annulé (tracé dans le journal).");
    refreshAll();
  };
  const ds = tab === "journal" ? "transactions" : "payments";

  return (
    <div>
      <Link href="/finances" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Finances</Link>
      <PageHeader
        title="Journal financier"
        icon={<ReceiptText className="h-5 w-5" />}
        subtitle="Toutes les opérations, dans l'ordre. Rien n'est jamais supprimé : chaque correction laisse une trace."
        actions={
          <>
            <a href={`/api/export${qsOf({ dataset: ds, format: "xlsx", studentId: f.studentId, from: f.from, to: f.to })}`}><Button variant="secondary"><FileDown className="h-4 w-4" />Excel</Button></a>
            <a href={`/api/export${qsOf({ dataset: ds, format: "pdf", studentId: f.studentId, from: f.from, to: f.to })}`}><Button variant="secondary"><FileDown className="h-4 w-4" />PDF</Button></a>
          </>
        }
      />
      <Tabs tabs={[{ value: "journal", label: "Journal des transactions" }, { value: "versements", label: "Versements et reçus" }]} value={tab} onChange={(v) => { setTab(v); setF({ ...f, type: "" }); }} />
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Select value={f.studentId} onChange={(e) => up("studentId", e.target.value)} options={refs.students.map((s) => ({ value: s.id, label: fullName(s) }))} placeholder="Tous les élèves" />
        {tab === "journal" ? (
          <Select value={f.type} onChange={(e) => up("type", e.target.value)} options={Object.fromEntries(Object.entries(TX_TYPES).map(([k, v]) => [k, v.label]))} placeholder="Toutes opérations" />
        ) : (
          <>
            <Select value={f.type} onChange={(e) => up("type", e.target.value)} options={PAYMENT_KINDS} placeholder="Tous types" />
            <Select value={f.method} onChange={(e) => up("method", e.target.value)} options={PAYMENT_METHODS} placeholder="Tous modes" />
          </>
        )}
        <Input type="date" value={f.from} onChange={(e) => up("from", e.target.value)} aria-label="Du" />
        <Input type="date" value={f.to} onChange={(e) => up("to", e.target.value)} aria-label="Au" />
      </div>
      {tab === "journal" ? (
        tx.error ? <ErrorBox error={tx.error} /> : !tx.data ? <Loading rows={8} /> : tx.data.items.length === 0 ? <Empty title="Aucune opération" /> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Saisie</th><th>Date</th><th>Élève</th><th>Opération</th><th>Description</th><th className="num">Montant</th><th className="num">Reste dû</th><th className="num">Crédit</th></tr></thead>
                <tbody>
                  {tx.data.items.map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap text-xs text-muted">{new Date(t.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Tunis" })}</td>
                      <td className="whitespace-nowrap">{shortDate(t.date)}</td>
                      <td>{t.student && <Link href={`/eleves/${t.student.id}?tab=historique`} className="hover:underline">{fullName(t.student)}</Link>}</td>
                      <td><TxBadge type={t.type} /></td>
                      <td className="max-w-sm text-ink-2">{t.description}</td>
                      <td className="num font-medium">{formatDT(Number(t.amount))}</td>
                      <td className="num"><Money value={Number(t.dueAfter)} tone="due" /></td>
                      <td className="num"><Money value={Number(t.creditAfter)} tone="credit" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>Page {page + 1} / {pages} · {tx.data.total} opérations</span>
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="icon-sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </>
        )
      ) : pays.error ? <ErrorBox error={pays.error} /> : !pays.data ? <Loading rows={8} /> : pays.data.length === 0 ? <Empty title="Aucun versement" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>N° reçu</th><th>Élève</th><th>Type</th><th>Mode</th><th>Motif</th><th className="num">Montant</th><th></th></tr></thead>
            <tbody>
              {pays.data.map((p) => (
                <tr key={p.id} className={p.voidedAt ? "opacity-60" : ""}>
                  <td className="whitespace-nowrap">{shortDate(p.date)}</td>
                  <td className="text-xs">{p.receiptNo ?? "—"}</td>
                  <td>{p.student && fullName(p.student)}</td>
                  <td><Badge tone={p.kind === "ADVANCE" ? "info" : p.kind === "DISCOUNT" ? "accent" : "success"}>{PAYMENT_KINDS[p.kind]}</Badge></td>
                  <td className="text-xs">{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS]}</td>
                  <td className="text-ink-2">{p.reason ?? "—"}{p.voidedAt && <div className="text-xs text-danger">Annulé : {p.voidReason}</div>}</td>
                  <td className={`num font-medium ${p.voidedAt ? "line-through" : ""}`}>{formatDT(Number(p.amount))}</td>
                  <td className="whitespace-nowrap text-right">
                    {p.receiptNo && <a href={`/api/payments/${p.id}/receipt`} target="_blank" rel="noreferrer"><Button size="icon-sm" variant="ghost" title="Reçu PDF"><FileDown className="h-4 w-4" /></Button></a>}
                    {!p.voidedAt && <Button size="icon-sm" variant="danger-ghost" title="Annuler" onClick={() => voidIt(p)}><Ban className="h-4 w-4" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
