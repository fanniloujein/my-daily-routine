"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, TrendingUp, Wallet } from "lucide-react";
import { Button, Card, Field, Loading, Modal, PageHeader, Segmented, useUi } from "@/components/ui";
import { BarChart, HBars } from "@/components/charts";
import { IncomeList, useMoney, type Income } from "@/components/Payments";
import { api, cx, refreshAll, useApi } from "@/lib/client";
import { today } from "@/lib/dates";
import { INCOME_SOURCES, PAYMENT_METHODS, addMonthsStr, monthLabel } from "@/lib/billing";

type Finance = {
  month: string;
  totals: { receivedMonth: number; receivedTutoringMonth: number; dueMonth: number; outstanding: number; receivedYear: number };
  byMonth: { month: string; total: number; tutoring: number; freelance: number; other: number }[];
  incomes: Income[];
};

export default function RevenusPage() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [source, setSource] = useState<"all" | "TUTORING" | "FREELANCE" | "OTHER">("all");
  const [add, setAdd] = useState(false);
  const { data, mutate } = useApi<Finance>(`/api/finance?month=${month}`);
  const { fmt } = useMoney();

  if (!data) return <Loading />;
  const cur = data.byMonth[data.byMonth.length - 1];
  const prev = data.byMonth[data.byMonth.length - 2];
  const nonZero = data.byMonth.filter((m) => m.total > 0);
  const avg = nonZero.length ? nonZero.reduce((a, m) => a + m.total, 0) / nonZero.length : 0;
  const list = data.incomes.filter((i) => i.date.slice(0, 7) === month && (source === "all" || i.source === source));

  return (
    <div>
      <PageHeader
        title="Mes revenus"
        subtitle="Chaque paiement de cours enregistré arrive ici automatiquement. Ajoute aussi tes revenus freelance et autres."
        actions={
          <Button onClick={() => setAdd(true)}>
            <Plus className="h-4 w-4" /> Ajouter un revenu
          </Button>
        }
      />
      <div className="mb-5 flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={() => setMonth(addMonthsStr(month, -1))} aria-label="Mois précédent">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="min-w-[9rem] text-center font-display text-lg font-semibold text-ink">{monthLabel(month)}</span>
        <Button size="icon" variant="ghost" onClick={() => setMonth(addMonthsStr(month, 1))} aria-label="Mois suivant">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Ce mois-ci" value={fmt(cur.total)} sub={prev.total ? `${cur.total >= prev.total ? "▲" : "▼"} ${fmt(Math.abs(cur.total - prev.total))} vs mois précédent` : undefined} tone="success" />
        <Tile label={`Total ${month.slice(0, 4)}`} value={fmt(data.totals.receivedYear)} />
        <Tile label="Moyenne mensuelle" value={fmt(avg)} sub="sur les mois avec revenus" />
        <Tile label="Reste à recevoir (cours)" value={fmt(data.totals.outstanding)} tone={data.totals.outstanding > 0 ? "warning" : undefined} link />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Revenus des 12 derniers mois" icon={<TrendingUp className="h-4 w-4" />} className="lg:col-span-2">
          <BarChart
            data={data.byMonth.map((m) => ({ label: monthLabel(m.month).slice(0, 3), value: Math.round(m.total), tooltip: `${monthLabel(m.month)} : ${fmt(m.total)} (cours ${fmt(m.tutoring)}, freelance ${fmt(m.freelance)}, autre ${fmt(m.other)})` }))}
            color="rgb(var(--success))"
            format={(v) => fmt(v)}
          />
        </Card>
        <Card title={`Répartition — ${monthLabel(month).toLowerCase()}`} icon={<Wallet className="h-4 w-4" />}>
          {cur.total === 0 ? (
            <p className="text-sm text-muted">Aucun revenu ce mois-ci.</p>
          ) : (
            <HBars
              data={[
                { label: INCOME_SOURCES.TUTORING, value: cur.tutoring, color: "rgb(var(--primary))" },
                { label: INCOME_SOURCES.FREELANCE, value: cur.freelance, color: "rgb(var(--lavender))" },
                { label: INCOME_SOURCES.OTHER, value: cur.other, color: "rgb(var(--warning))" },
              ].filter((x) => x.value > 0)}
              format={fmt}
            />
          )}
        </Card>
        <Card
          title="Détail des revenus"
          className="lg:col-span-3"
          action={
            <Segmented
              value={source}
              onChange={setSource}
              options={[
                { value: "all", label: "Tout" },
                { value: "TUTORING", label: "Cours" },
                { value: "FREELANCE", label: "Freelance" },
                { value: "OTHER", label: "Autre" },
              ]}
            />
          }
        >
          <IncomeList incomes={list} onChanged={() => mutate()} empty="Aucun revenu pour ce mois et ce filtre." showSource />
          <p className="mt-3 text-xs text-muted">
            Les paiements de cours s&apos;enregistrent depuis <Link href="/cours" className="text-primary-strong underline">Cours particuliers → 💶 Paiements</Link> ou depuis la fiche d&apos;une séance.
          </p>
        </Card>
      </div>
      {add && <AddIncome onClose={() => setAdd(false)} onSaved={() => mutate()} />}
    </div>
  );
}

function Tile({ label, value, sub, tone, link }: { label: string; value: string; sub?: string; tone?: "success" | "warning"; link?: boolean }) {
  const inner = (
    <>
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("mt-1 font-display text-2xl font-semibold", tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-ink")}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </>
  );
  return link ? (
    <Link href="/cours" className="card p-4 transition hover:shadow-pop">
      {inner}
    </Link>
  ) : (
    <div className="card p-4">{inner}</div>
  );
}

function AddIncome({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const { currency, fmt } = useMoney();
  const [f, setF] = useState({ source: "FREELANCE", label: "", amount: "", date: today(), method: "TRANSFER", note: "" });
  async function save() {
    if (!Number(f.amount)) return toast("Indique un montant", "danger");
    try {
      await api("/api/incomes", { body: { ...f, amount: Number(f.amount), label: f.label || null, note: f.note || null, lessonIds: [] } });
      await refreshAll();
      onSaved();
      toast(`${fmt(Number(f.amount))} ajoutés à tes revenus`);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }
  return (
    <Modal open onClose={onClose} title="Ajouter un revenu" footer={<Button onClick={save}>Enregistrer</Button>}>
      <div className="space-y-3">
        <div>
          <span className="label">Type</span>
          <Segmented value={f.source} onChange={(v) => setF({ ...f, source: v })} options={[{ value: "FREELANCE", label: "Freelance" }, { value: "OTHER", label: "Autre" }]} />
          <p className="mt-1 text-xs text-muted">Pour un élève, passe par « Cours particuliers → 💶 Paiements » afin de cocher les séances réglées.</p>
        </div>
        <Field label="Libellé">
          <input className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Ex. Acompte site vitrine — client X" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Montant (${currency})`}>
            <input type="number" min={0} step="0.5" className="input" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
        </div>
        <Field label="Moyen de paiement">
          <select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note (facultatif)">
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
