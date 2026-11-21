"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, FileDown, HandCoins, PiggyBank, Plus, ReceiptText, RotateCcw, TrendingUp, Wallet } from "lucide-react";
import { fullName, qsOf, useApi } from "@/lib/client";
import { BILLING_MODES } from "@/lib/finance";
import { monthLabel, monthOf, shortDate, shortMonth, today } from "@/lib/dates";
import { formatDT } from "@/lib/money";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Select, Stat } from "@/components/ui";
import { Money, useRefs } from "@/components/shared";
import { Bars, Donut } from "@/components/charts";
import { PaymentDialog, type PaymentKind } from "@/components/PaymentDialog";

type Row = { id: string; name: string; level: string | null; subjects: string[]; billingMode: string; rate: number; sessionsDone: number; sessionsBilled: number; sessionsPaid: number; billed: number; paid: number; advances: number; credit: number; due: number; totalDue: number; oldestUnpaid: string | null; late: boolean; status: "LATE" | "DUE" | "CREDIT" | "SETTLED" };
type Ov = { rows: Row[]; totals: { billed: number; paid: number; credit: number; due: number } };
type Stats = {
  totals: { revenueToday: number; revenueWeek: number; revenueMonth: number; revenueYear: number; revenueRange: number; receivedRange: number; creditAvailable: number; receivables: number; refundedRange: number; refundedAll: number };
  months: { month: string; revenue: number; received: number; billed: number }[];
  days: { date: string; revenue: number }[];
  byStudent: { id: string; name: string; revenue: number }[];
  bySubject: { id: string; name: string; color: string; revenue: number }[];
};
const STATUS = { LATE: { label: "En retard", tone: "danger" }, DUE: { label: "À payer", tone: "warning" }, CREDIT: { label: "Crédit", tone: "info" }, SETTLED: { label: "À jour", tone: "success" } } as const;

function FinanceInner() {
  const sp = useSearchParams();
  const refs = useRefs();
  const t = today();
  const [f, setF] = useState({ studentId: "", levelId: "", subjectId: "", month: "", status: sp.get("status") ?? "" });
  const [range, setRange] = useState({ from: `${t.slice(0, 4)}-01-01`, to: t });
  const [pay, setPay] = useState<{ kind: PaymentKind; studentId?: string } | null>(sp.get("pay") ? { kind: "PAYMENT" } : null);
  const ov = useApi<Ov>(`/api/finance/overview${qsOf(f)}`);
  const st = useApi<Stats>(`/api/finance/stats${qsOf(range)}`);
  const s = st.data?.totals;
  const exp = (dataset: string, format: string) => `/api/export${qsOf({ dataset, format, ...(dataset === "finance" ? f : range) })}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Finances"
        icon={<Wallet className="h-5 w-5" />}
        subtitle="Situation exacte de chaque élève : frais, paiements, avances, crédit et reste à payer."
        actions={
          <>
            <Link href="/finances/journal"><Button variant="secondary"><ReceiptText className="h-4 w-4" />Journal</Button></Link>
            <Button variant="secondary" onClick={() => setPay({ kind: "ADVANCE" })}><PiggyBank className="h-4 w-4" />Avance</Button>
            <Button onClick={() => setPay({ kind: "PAYMENT" })}><Plus className="h-4 w-4" />Paiement</Button>
          </>
        }
      />
      {s && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Revenus encaissés aujourd'hui" value={formatDT(s.revenueToday)} icon={<CalendarDays className="h-5 w-5" />} tone="success" hint={`Semaine : ${formatDT(s.revenueWeek)}`} />
          <Stat label="Revenus encaissés ce mois" value={formatDT(s.revenueMonth)} icon={<TrendingUp className="h-5 w-5" />} tone="success" hint={`Année : ${formatDT(s.revenueYear)}`} />
          <Stat label="Avances non consommées" value={formatDT(s.creditAvailable)} icon={<PiggyBank className="h-5 w-5" />} tone="info" hint="crédit des élèves, pas encore un revenu" />
          <Stat label="Créances restantes" value={formatDT(s.receivables)} icon={<HandCoins className="h-5 w-5" />} tone={s.receivables > 0 ? "danger" : "muted"} hint={`Remboursé (total) : ${formatDT(s.refundedAll)}`} />
        </div>
      )}

      <Card title="Tableau financier général" action={
        <div className="flex gap-1.5">
          <a href={exp("finance", "xlsx")}><Button size="sm" variant="secondary"><FileDown className="h-4 w-4" />Excel</Button></a>
          <a href={exp("finance", "pdf")}><Button size="sm" variant="secondary"><FileDown className="h-4 w-4" />PDF</Button></a>
        </div>
      }>
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Select value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })} options={refs.students.map((x) => ({ value: x.id, label: fullName(x) }))} placeholder="Tous les élèves" />
          <Select value={f.levelId} onChange={(e) => setF({ ...f, levelId: e.target.value })} options={refs.levels.map((x) => ({ value: x.id, label: x.name }))} placeholder="Tous niveaux" />
          <Select value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })} options={refs.subjects.map((x) => ({ value: x.id, label: x.name }))} placeholder="Toutes matières" />
          <Input type="month" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} aria-label="Mois" />
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={{ DUE: "Reste à payer", LATE: "En retard", CREDIT: "Avec crédit", SETTLED: "À jour" }} placeholder="Tous statuts" />
        </div>
        {f.month && <p className="mb-2 text-xs text-muted">Frais, payé et reste calculés sur les séances de {monthLabel(f.month)} ; crédit = crédit actuel.</p>}
        {ov.error ? <ErrorBox error={ov.error} retry={() => ov.mutate()} /> : !ov.data ? <Loading rows={5} /> : ov.data.rows.length === 0 ? <Empty title="Aucun élève ne correspond" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Élève</th><th>Mode</th><th className="num">Séances</th><th className="num">Frais dus</th><th className="num">Payé</th><th className="num">Crédit disponible</th><th className="num">Reste à payer</th><th>Statut</th><th></th></tr>
              </thead>
              <tbody>
                {ov.data.rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/eleves/${r.id}?tab=solde`} className="font-medium hover:underline">{r.name}</Link><div className="text-xs text-muted">{r.level ?? ""}</div></td>
                    <td className="text-xs">{BILLING_MODES[r.billingMode as keyof typeof BILLING_MODES]}<div className="text-muted">{formatDT(r.rate)}</div></td>
                    <td className="num text-xs">{r.sessionsDone} eff.<div className="text-muted">{r.sessionsPaid}/{r.sessionsBilled} payées</div></td>
                    <td className="num">{formatDT(r.billed)}</td>
                    <td className="num"><Money value={r.paid} tone="paid" /></td>
                    <td className="num"><Money value={r.credit} tone="credit" /></td>
                    <td className="num"><Money value={r.due} tone="due" strong />{r.oldestUnpaid && r.due > 0 && <div className="text-xs text-muted">depuis {shortDate(r.oldestUnpaid)}</div>}</td>
                    <td><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></td>
                    <td className="text-right">{r.totalDue > 0 && <Button size="sm" variant="success" onClick={() => setPay({ kind: "PAYMENT", studentId: r.id })}>Encaisser</Button>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2/60 font-semibold">
                  <td className="px-3 py-2.5" colSpan={3}>Total ({ov.data.rows.length} élèves)</td>
                  <td className="num px-3">{formatDT(ov.data.totals.billed)}</td>
                  <td className="num px-3 text-success">{formatDT(ov.data.totals.paid)}</td>
                  <td className="num px-3 text-primary-strong">{formatDT(ov.data.totals.credit)}</td>
                  <td className="num px-3 text-danger">{formatDT(ov.data.totals.due)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Statistiques du"><Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
        <Field label="au"><Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
        <Button variant="ghost" onClick={() => setRange({ from: `${monthOf(t)}-01`, to: t })}>Ce mois</Button>
        <Button variant="ghost" onClick={() => setRange({ from: `${t.slice(0, 4)}-01-01`, to: t })}>Cette année</Button>
        <Button variant="ghost" onClick={() => setRange({ from: "2000-01-01", to: t })}><RotateCcw className="h-4 w-4" />Tout</Button>
        {s && <div className="ml-auto text-sm text-muted">Revenus sur la période : <b className="text-success">{formatDT(s.revenueRange)}</b> · encaissements : <b className="text-ink">{formatDT(s.receivedRange)}</b> · remboursé : <b className="text-ink">{formatDT(s.refundedRange)}</b></div>}
      </div>
      {st.data && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Évolution mensuelle" className="lg:col-span-2">
            <Bars data={st.data.months} x="month" money xFormat={shortMonth} series={[{ key: "billed", label: "Facturé", color: "var(--s4)" }, { key: "revenue", label: "Revenus encaissés", color: "var(--s1)" }]} />
            <p className="mt-2 text-xs text-muted">Revenus encaissés = argent réellement affecté à des séances ou forfaits (une avance compte au moment où elle est consommée).</p>
          </Card>
          <Card title="Revenus journaliers">
            {st.data.days.length === 0 ? <Empty title="Aucun revenu sur la période" /> : <Bars data={st.data.days.slice(-31)} x="date" money xFormat={(d) => shortDate(d).slice(0, 5)} series={[{ key: "revenue", label: "Revenus", color: "var(--s3)" }]} />}
          </Card>
          <Card title="Revenus par matière">
            {st.data.bySubject.length === 0 ? <Empty title="—" /> : <Donut money data={st.data.bySubject.map((x) => ({ name: x.name, value: x.revenue, color: x.color }))} />}
          </Card>
          <Card title="Revenus par élève" className="lg:col-span-2">
            {st.data.byStudent.length === 0 ? <Empty title="—" /> : (
              <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {st.data.byStudent.map((x) => {
                  const max = st.data!.byStudent[0].revenue || 1;
                  return (
                    <li key={x.id} className="text-sm">
                      <div className="flex justify-between"><Link href={`/eleves/${x.id}`} className="hover:underline">{x.name}</Link><span className="tabular-nums">{formatDT(x.revenue)}</span></div>
                      <div className="mt-1 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full" style={{ width: `${(x.revenue / max) * 100}%`, background: "var(--s1)" }} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
      <PaymentDialog open={!!pay} kind={pay?.kind} studentId={pay?.studentId} onClose={() => { setPay(null); ov.mutate(); st.mutate(); }} />
    </div>
  );
}

export default function FinancePage() {
  return <Suspense><FinanceInner /></Suspense>;
}
