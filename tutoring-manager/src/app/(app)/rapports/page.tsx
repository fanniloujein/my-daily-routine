"use client";
import { useState } from "react";
import { ChartPie, FileDown, Printer } from "lucide-react";
import { qsOf, useApi } from "@/lib/client";
import { TIME_CATEGORIES, PROGRESS_STATUS } from "@/lib/constants";
import { addDays, shortDate, shortMonth, today } from "@/lib/dates";
import { formatDT } from "@/lib/money";
import { Button, Card, Empty, Field, Input, Loading, PageHeader } from "@/components/ui";
import { Bars, Donut, Lines, SERIES } from "@/components/charts";

type A = {
  pedagogy: { students: number; byLevel: { name: string; count: number }[]; bySubject: { name: string; color: string; count: number }[]; sessionsByMonth: { month: string; done: number; cancelled: number; absent: number; hours: number }[]; hoursTaught: number; progression: { month: string; average: number }[]; progressStatus: Record<string, number>; assessments: number };
  finance: { totals: Record<string, number>; months: { month: string; revenue: number; received: number; billed: number }[]; byStudent: { id: string; name: string; revenue: number }[]; bySubject: { name: string; color: string; revenue: number }[] };
  productivity: { weekly: ({ week: string } & Record<string, number>)[]; totals: Record<string, number> };
};

export default function ReportsPage() {
  const t = today();
  const [r, setR] = useState({ from: `${t.slice(0, 4)}-01-01`, to: t });
  const { data } = useApi<A>(`/api/analytics${qsOf(r)}`);
  const presets = [["30 jours", addDays(t, -29)], ["3 mois", addDays(t, -91)], ["Année", `${t.slice(0, 4)}-01-01`], ["Année scolaire", `${Number(t.slice(5, 7)) >= 9 ? t.slice(0, 4) : Number(t.slice(0, 4)) - 1}-09-01`]];
  const exp = (dataset: string, format: string) => `/api/export${qsOf({ dataset, format, ...r })}`;
  return (
    <div className="space-y-5">
      <PageHeader title="Rapports & statistiques" icon={<ChartPie className="h-5 w-5" />} subtitle={`Du ${shortDate(r.from)} au ${shortDate(r.to)}`} actions={<Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimer / PDF</Button>} />
      <div className="no-print flex flex-wrap items-end gap-2">
        <Field label="Du"><Input type="date" value={r.from} onChange={(e) => setR({ ...r, from: e.target.value })} /></Field>
        <Field label="Au"><Input type="date" value={r.to} onChange={(e) => setR({ ...r, to: e.target.value })} /></Field>
        {presets.map(([l, f]) => <Button key={l} variant="ghost" onClick={() => setR({ from: f, to: t })}>{l}</Button>)}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {[["sessions", "Séances"], ["payments", "Versements"], ["transactions", "Journal"], ["finance", "Situation"]].map(([d, l]) => (
            <a key={d} href={exp(d, "xlsx")}><Button size="sm" variant="secondary"><FileDown className="h-4 w-4" />{l} (Excel)</Button></a>
          ))}
        </div>
      </div>
      {!data ? <Loading rows={6} /> : (
        <>
          <h2 className="font-display text-lg font-semibold">Pédagogie</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Élèves actifs", data.pedagogy.students], ["Heures enseignées", `${data.pedagogy.hoursTaught} h`], ["Séances effectuées", data.pedagogy.sessionsByMonth.reduce((a, m) => a + m.done, 0)], ["Notes saisies", data.pedagogy.assessments]].map(([l, v]) => (
              <div key={String(l)} className="card p-4"><div className="text-xs text-muted">{l}</div><div className="font-display text-xl font-semibold">{v}</div></div>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Élèves par niveau">{data.pedagogy.byLevel.length ? <Donut data={data.pedagogy.byLevel.slice(0, 6).map((x, i) => ({ name: x.name, value: x.count, color: SERIES[i] })).concat(data.pedagogy.byLevel.length > 6 ? [{ name: "Autres", value: data.pedagogy.byLevel.slice(6).reduce((a, x) => a + x.count, 0), color: "var(--s-other)" }] : [])} /> : <Empty title="—" />}</Card>
            <Card title="Élèves par matière">{data.pedagogy.bySubject.length ? <Donut data={data.pedagogy.bySubject.map((x) => ({ name: x.name, value: x.count, color: x.color }))} /> : <Empty title="—" />}</Card>
            <Card title="Séances par mois">{data.pedagogy.sessionsByMonth.length ? <Bars data={data.pedagogy.sessionsByMonth} x="month" stacked xFormat={shortMonth} series={[{ key: "done", label: "Effectuées", color: "var(--s1)" }, { key: "absent", label: "Absences élève", color: "var(--s2)" }, { key: "cancelled", label: "Annulées / reportées", color: "var(--s-other)" }]} /> : <Empty title="—" />}</Card>
            <Card title="Heures enseignées par mois">{data.pedagogy.sessionsByMonth.length ? <Bars data={data.pedagogy.sessionsByMonth} x="month" xFormat={shortMonth} series={[{ key: "hours", label: "Heures", color: "var(--s3)" }]} /> : <Empty title="—" />}</Card>
            <Card title="Progression des élèves (moyenne des notes /20)">
              {data.pedagogy.progression.length > 1 ? <Lines data={data.pedagogy.progression} x="month" xFormat={shortMonth} domain={[0, 20]} series={[{ key: "average", label: "Moyenne", color: "var(--s1)" }]} /> : <Empty title="Pas assez de notes sur la période" />}
              <div className="mt-3 flex flex-wrap gap-3 text-sm">{Object.entries(PROGRESS_STATUS).map(([k, l]) => <span key={k}>{l} : <b>{data.pedagogy.progressStatus[k] ?? 0}</b> chapitre(s)</span>)}</div>
            </Card>
          </div>

          <h2 className="pt-2 font-display text-lg font-semibold">Finances</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Revenus de la période", formatDT(data.finance.totals.revenueRange)], ["Encaissements", formatDT(data.finance.totals.receivedRange)], ["Paiements en attente", formatDT(data.finance.totals.receivables)], ["Avances disponibles", formatDT(data.finance.totals.creditAvailable)]].map(([l, v]) => (
              <div key={String(l)} className="card p-4"><div className="text-xs text-muted">{l}</div><div className="font-display text-xl font-semibold">{v}</div></div>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Revenus par mois — évolution" className="lg:col-span-2">{data.finance.months.length ? <Bars data={data.finance.months} x="month" money xFormat={shortMonth} series={[{ key: "revenue", label: "Revenus encaissés", color: "var(--s1)" }]} /> : <Empty title="—" />}</Card>
            <Card title="Revenus par matière">{data.finance.bySubject.length ? <Donut money data={data.finance.bySubject.map((x) => ({ name: x.name, value: x.revenue, color: x.color }))} /> : <Empty title="—" />}</Card>
            <Card title="Revenus par élève">
              {data.finance.byStudent.length === 0 ? <Empty title="—" /> : <ul className="space-y-1.5 text-sm">{data.finance.byStudent.map((x) => <li key={x.id} className="flex justify-between"><span>{x.name}</span><span className="tabular-nums">{formatDT(x.revenue)}</span></li>)}</ul>}
            </Card>
          </div>

          <h2 className="pt-2 font-display text-lg font-semibold">Productivité</h2>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card title="Répartition hebdomadaire (h)" className="lg:col-span-2">
              {data.productivity.weekly.length ? <Bars data={data.productivity.weekly} x="week" stacked xFormat={(w) => shortDate(w).slice(0, 5)} series={Object.entries(TIME_CATEGORIES).filter(([k]) => k !== "OTHER").map(([k, c]) => ({ key: k, label: c.label, color: c.color }))} /> : <Empty title="—" />}
            </Card>
            <Card title="Total par activité">
              <ul className="space-y-2 text-sm">{Object.entries(TIME_CATEGORIES).map(([k, c]) => <li key={k} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} /><span className="flex-1">{c.label}</span><span className="tabular-nums">{data.productivity.totals[k] ?? 0} h</span></li>)}</ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
