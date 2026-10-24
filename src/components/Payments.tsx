"use client";

import { useMemo, useState } from "react";
import { Banknote, Check, ChevronLeft, ChevronRight, HandCoins, Trash2, Wallet } from "lucide-react";
import { Badge, Button, Card, Empty, Field, Loading, Modal, Notice, useUi } from "./ui";
import { NameTag } from "./NameTag";
import { api, cx, fmtDayNum, refreshAll, useApi } from "@/lib/client";
import { useMe } from "@/lib/hooks";
import { today } from "@/lib/dates";
import { BILLING_LABELS, DEFAULT_CURRENCY, PAYMENT_METHODS, addMonthsStr, formatMoney, monthLabel, type BillingMode } from "@/lib/billing";

export type FinanceRow = {
  id: string;
  name: string;
  color: string;
  isGroup: boolean;
  members: { id: string; name: string; color: string }[];
  billingMode: BillingMode;
  rate: number | null;
  month: { sessions: number; planned: number; due: number; paid: number; remaining: number };
  unpaidLessons: { id: string; date: string; startTime: string; subject: string; price: number }[];
  unpaidMonths: { month: string; due: number; paid: number }[];
  outstanding: number;
  totalPaid: number;
};

export type Income = {
  id: string;
  date: string;
  amount: number;
  source: string;
  label: string | null;
  studentId: string | null;
  period: string | null;
  method: string | null;
  note: string | null;
  lessonCount?: number;
  student?: { id: string; name: string; color: string; isGroup: boolean } | null;
};

type Finance = {
  month: string;
  rows: FinanceRow[];
  totals: { receivedMonth: number; receivedTutoringMonth: number; dueMonth: number; outstanding: number; receivedYear: number };
  byMonth: { month: string; total: number; tutoring: number; freelance: number; other: number }[];
  incomes: Income[];
};

export function useMoney() {
  const { data: me } = useMe();
  const code = me?.settings.currency ?? DEFAULT_CURRENCY;
  // « currency » = libellé court affiché dans les formulaires (DT, DA, DH, EUR…)
  const currency = ({ TND: "DT", DZD: "DA", MAD: "DH" } as Record<string, string>)[code] ?? code;
  return { currency, code, fmt: (n: number) => formatMoney(n, code) };
}

export function rateLabel(mode: BillingMode, rate: number | null, fmt: (n: number) => string) {
  if (mode === "FREE") return "Gratuit";
  if (!rate) return "Tarif non défini";
  return mode === "SESSION" ? `${fmt(rate)} / séance` : mode === "HOUR" ? `${fmt(rate)} / heure` : `${fmt(rate)} / mois`;
}

/** Onglet « Paiements » des cours particuliers. */
export function PaymentsView({ onEditStudent }: { onEditStudent: (id: string) => void }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const { data, mutate } = useApi<Finance>(`/api/finance?month=${month}`);
  const { fmt } = useMoney();
  const [pay, setPay] = useState<FinanceRow | null>(null);
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);

  if (!data) return <Loading />;
  const rows = data.rows.filter((r) => !onlyUnpaid || r.outstanding > 0);
  const tutoringIncomes = data.incomes.filter((i) => i.source === "TUTORING" && i.date.slice(0, 7) === month);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setMonth(addMonthsStr(month, -1))} aria-label="Mois précédent">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="min-w-[9rem] text-center font-display text-lg font-semibold text-ink">{monthLabel(month)}</span>
          <Button size="icon" variant="ghost" onClick={() => setMonth(addMonthsStr(month, 1))} aria-label="Mois suivant">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={onlyUnpaid} onChange={(e) => setOnlyUnpaid(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--primary))]" /> Seulement ceux qui me doivent de l&apos;argent
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Encaissé ce mois (cours)" value={fmt(data.totals.receivedTutoringMonth)} tone="success" />
        <Tile label="Facturé ce mois" value={fmt(data.totals.dueMonth)} hint="Séances réalisées + forfaits" />
        <Tile label="Reste à recevoir (total)" value={fmt(data.totals.outstanding)} tone={data.totals.outstanding > 0 ? "warning" : "success"} hint="Toutes périodes" />
        <Tile label={`Revenus ${month.slice(0, 4)} (tout)`} value={fmt(data.totals.receivedYear)} hint="Voir la page Revenus" />
      </div>

      <Card title="Par élève et par groupe" icon={<Wallet className="h-4 w-4" />}>
        {rows.length === 0 ? (
          <Empty title={onlyUnpaid ? "Personne ne te doit d'argent 🎉" : "Aucun élève"} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-medium">Élève / groupe</th>
                    <th className="py-2 pr-3 font-medium">Tarif</th>
                    <th className="py-2 pr-3 text-right font-medium">Séances faites</th>
                    <th className="py-2 pr-3 text-right font-medium">Dû ce mois</th>
                    <th className="py-2 pr-3 text-right font-medium">Payé ce mois</th>
                    <th className="py-2 pr-3 font-medium">Statut du mois</th>
                    <th className="py-2 pr-3 text-right font-medium">Reste total</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-line/50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <NameTag name={r.name} color={r.color} group={r.isGroup} />
                      </td>
                      <td className="py-2.5 pr-3">
                        <button className={cx("text-left text-xs", r.rate || r.billingMode === "FREE" ? "text-ink-2" : "font-medium text-warning underline")} onClick={() => onEditStudent(r.id)}>
                          {rateLabel(r.billingMode, r.rate, fmt)}
                        </button>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-2">{r.month.sessions}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink">{r.month.due ? fmt(r.month.due) : "—"}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink">{r.month.paid ? fmt(r.month.paid) : "—"}</td>
                      <td className="py-2.5 pr-3">
                        <MonthStatus r={r} fmt={fmt} />
                      </td>
                      <td className={cx("py-2.5 pr-3 text-right font-semibold tabular-nums", r.outstanding > 0 ? "text-warning" : "text-success")}>{r.outstanding > 0 ? fmt(r.outstanding) : "0"}</td>
                      <td className="py-2.5 text-right">
                        {r.billingMode !== "FREE" && (
                          <Button size="sm" variant={r.outstanding > 0 ? "primary" : "secondary"} onClick={() => setPay(r)}>
                            <HandCoins className="h-3.5 w-3.5" /> Encaisser
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-3 md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-line/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <NameTag name={r.name} color={r.color} group={r.isGroup} />
                    <MonthStatus r={r} fmt={fmt} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted">Dû (mois)</div>
                      <div className="font-medium text-ink">{fmt(r.month.due)}</div>
                    </div>
                    <div>
                      <div className="text-muted">Payé (mois)</div>
                      <div className="font-medium text-ink">{fmt(r.month.paid)}</div>
                    </div>
                    <div>
                      <div className="text-muted">Reste total</div>
                      <div className={cx("font-semibold", r.outstanding > 0 ? "text-warning" : "text-success")}>{fmt(r.outstanding)}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button className="text-xs text-ink-2 underline" onClick={() => onEditStudent(r.id)}>
                      {rateLabel(r.billingMode, r.rate, fmt)}
                    </button>
                    {r.billingMode !== "FREE" && (
                      <Button size="sm" onClick={() => setPay(r)}>
                        <HandCoins className="h-3.5 w-3.5" /> Encaisser
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {data.rows.some((r) => r.unpaidLessons.length || r.unpaidMonths.length) && (
        <Card title="Détail de ce qui reste à payer" icon={<Banknote className="h-4 w-4" />}>
          <ul className="space-y-3">
            {data.rows
              .filter((r) => r.unpaidLessons.length || r.unpaidMonths.length)
              .map((r) => (
                <li key={r.id} className="rounded-xl bg-surface-2/50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <NameTag name={r.name} color={r.color} group={r.isGroup} />
                    <span className="text-sm font-semibold text-warning">{fmt(r.outstanding)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.unpaidLessons.map((l) => (
                      <Badge key={l.id} tone="warning">
                        {fmtDayNum(l.date)} · {l.subject} · {fmt(l.price)}
                      </Badge>
                    ))}
                    {r.unpaidMonths.map((m) => (
                      <Badge key={m.month} tone="warning">
                        Forfait {monthLabel(m.month).toLowerCase()} · reste {fmt(m.due - m.paid)}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      )}

      <Card title={`Paiements reçus en ${monthLabel(month).toLowerCase()}`} icon={<Check className="h-4 w-4" />}>
        <IncomeList incomes={tutoringIncomes} onChanged={() => mutate()} empty="Aucun paiement de cours enregistré ce mois-ci." />
      </Card>

      {pay && <PaymentModal row={pay} onClose={() => setPay(null)} onSaved={() => mutate()} />}
    </div>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" | "warning" }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("mt-1 font-display text-2xl font-semibold", tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-ink")}>{value}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

function MonthStatus({ r, fmt }: { r: FinanceRow; fmt: (n: number) => string }) {
  if (r.billingMode === "FREE") return <Badge>Gratuit</Badge>;
  if (!r.month.due) return <Badge>Rien à payer ce mois</Badge>;
  if (r.billingMode === "MONTH" && r.month.sessions === 0 && r.month.paid === 0) return <Badge>Forfait à payer ce mois</Badge>;
  if (r.month.remaining <= 0) return <Badge tone="success">Payé ✓</Badge>;
  if (r.month.paid > 0) return <Badge tone="warning">Partiel · reste {fmt(r.month.remaining)}</Badge>;
  return <Badge tone="danger">Non payé</Badge>;
}

export function IncomeList({ incomes, onChanged, empty, showSource }: { incomes: Income[]; onChanged: () => void; empty: string; showSource?: boolean }) {
  const { fmt } = useMoney();
  const { confirm, toast } = useUi();
  if (incomes.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line/60">
      {incomes.map((i) => (
        <li key={i.id} className="group flex flex-wrap items-center gap-3 py-2.5">
          <span className="w-14 text-xs text-muted">{fmtDayNum(i.date)}</span>
          {i.student ? <NameTag name={i.student.name} color={i.student.color} group={i.student.isGroup} size="sm" /> : showSource && <Badge tone="lavender">{i.source === "FREELANCE" ? "Freelance" : "Autre"}</Badge>}
          <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
            {i.label ?? (i.period ? `Forfait ${monthLabel(i.period).toLowerCase()}` : i.lessonCount ? "Paiement de cours" : "Paiement")}
            {i.lessonCount && !/séance/i.test(i.label ?? "") ? ` · ${i.lessonCount} séance${i.lessonCount > 1 ? "s" : ""}` : ""}
            {i.method ? ` · ${PAYMENT_METHODS[i.method]}` : ""}
          </span>
          <span className="font-semibold tabular-nums text-success">+{fmt(i.amount)}</span>
          <button
            className="text-muted opacity-0 hover:text-danger group-hover:opacity-100"
            aria-label="Supprimer ce paiement"
            onClick={async () => {
              if (
                !(await confirm({
                  title: "Supprimer ce paiement ?",
                  message: i.lessonCount ? `Les ${i.lessonCount} séance(s) qu'il réglait redeviendront « à payer ». Il sera retiré de tes revenus.` : "Il sera retiré de tes revenus.",
                  danger: true,
                  confirmLabel: "Supprimer",
                }))
              )
                return;
              await api(`/api/incomes/${i.id}`, { method: "DELETE" });
              await refreshAll();
              onChanged();
              toast("Paiement supprimé");
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Encaisser un paiement d'élève / de groupe : séances à cocher ou mois de forfait. */
export function PaymentModal({ row, onClose, onSaved }: { row: FinanceRow; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const { fmt } = useMoney();
  const monthly = row.billingMode === "MONTH";
  const [selected, setSelected] = useState<string[]>(row.unpaidLessons.map((l) => l.id));
  const [period, setPeriod] = useState(row.unpaidMonths[row.unpaidMonths.length - 1]?.month ?? today().slice(0, 7));
  const suggested = useMemo(
    () => (monthly ? Math.max(0, (row.rate ?? 0) - (row.unpaidMonths.find((m) => m.month === period)?.paid ?? 0)) || (row.rate ?? 0) : row.unpaidLessons.filter((l) => selected.includes(l.id)).reduce((a, l) => a + l.price, 0)),
    [monthly, row, period, selected],
  );
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const value = amount === "" ? suggested : Number(amount);

  async function save() {
    if (!value || value <= 0) return toast("Indique un montant", "danger");
    setSaving(true);
    try {
      await api("/api/incomes", {
        body: {
          date,
          amount: value,
          source: "TUTORING",
          studentId: row.id,
          period: monthly ? period : null,
          method,
          note: note || null,
          label: monthly ? `Forfait ${monthLabel(period).toLowerCase()}` : selected.length ? null : "Avance",
          lessonIds: monthly ? [] : selected,
        },
      });
      await refreshAll();
      onSaved();
      toast(`${fmt(value)} encaissés ✓ — ajoutés à tes revenus`);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          Encaisser — <NameTag name={row.name} color={row.color} group={row.isGroup} />
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} loading={saving}>
            <Check className="h-4 w-4" /> Enregistrer {value ? fmt(value) : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {monthly ? (
          <Field label="Mois payé (forfait)">
            <input type="month" className="input" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
          </Field>
        ) : row.unpaidLessons.length === 0 ? (
          <Notice>Aucune séance réalisée en attente de paiement. Tu peux quand même enregistrer une avance : elle sera ajoutée à tes revenus.</Notice>
        ) : (
          <div>
            <span className="label">Séances réglées par ce paiement</span>
            <ul className="space-y-1">
              {row.unpaidLessons.map((l) => (
                <li key={l.id}>
                  <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(l.id)}
                      onChange={(e) => setSelected(e.target.checked ? [...selected, l.id] : selected.filter((x) => x !== l.id))}
                      className="h-4 w-4 accent-[rgb(var(--primary))]"
                    />
                    <span className="flex-1 text-ink">
                      {fmtDayNum(l.date)} · {l.subject}
                    </span>
                    <span className="tabular-nums text-ink-2">{fmt(l.price)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant reçu" hint={amount === "" ? `Calculé automatiquement : ${fmt(suggested)}` : "Montant saisi à la main"}>
            <input type="number" min={0} step="0.5" className="input" placeholder={String(suggested)} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date du paiement">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <div>
          <span className="label">Moyen de paiement</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setMethod(k)} className={cx("rounded-full border px-3 py-1.5 text-xs font-medium", method === k ? "border-primary bg-primary text-white dark:text-[#0e1322]" : "border-line text-ink-2")}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <Field label="Note (facultatif)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. payé par la maman" />
        </Field>
        <p className="text-xs text-muted">Ce paiement sera automatiquement ajouté à ta page Revenus.</p>
      </div>
    </Modal>
  );
}

export { BILLING_LABELS };
