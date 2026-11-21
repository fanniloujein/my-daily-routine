// ─────────────────────────────────────────────────────────────────────────────
// Moteur financier (fonctions pures, entièrement testées — tests/finance.test.ts)
//
// Principe : la situation d'un élève est TOUJOURS recalculée à partir des pièces
// enregistrées (factures, versements, remboursements), dans l'ordre réel où elles
// ont été saisies. Aucun solde n'est stocké « à la main » : impossible d'obtenir
// un solde incohérent, une double facturation ou une avance comptée deux fois.
//
//   • Facture (créance)   : séance effectuée, forfait du mois, correction (+).
//   • Versement           : PAYMENT (paiement), ADVANCE (avance), DISCOUNT (remise, non encaissée).
//   • Affectation         : un versement règle d'abord les factures ciblées (paiement
//                           groupé), puis les plus anciennes factures impayées ;
//                           le reste devient du CRÉDIT disponible.
//   • Nouvelle facture    : consomme automatiquement le crédit disponible (avances).
//   • Remboursement       : diminue le crédit disponible.
//
//   Total facturé    = Σ factures non annulées
//   Reste à payer    = Total facturé − Σ affectations
//   Crédit disponible = Σ versements − Σ affectations − Σ remboursements
//
// Un revenu n'est « encaissé » qu'au moment où de l'argent réel (paiement ou avance)
// est affecté à une prestation : une avance non consommée n'est pas un revenu.
// ─────────────────────────────────────────────────────────────────────────────

import type { Millimes } from "./money";

export type PaymentKind = "PAYMENT" | "ADVANCE" | "DISCOUNT";

export type FInvoice = { id: string; date: string; amount: Millimes; createdAt: Date | string | number; voided?: boolean; kind?: string };
export type FPayment = {
  id: string;
  kind: PaymentKind;
  date: string;
  amount: Millimes;
  createdAt: Date | string | number;
  voided?: boolean;
  targets?: string[];
};
export type FRefund = { id: string; date: string; amount: Millimes; createdAt: Date | string | number; voided?: boolean };

export type Allocation = {
  paymentId: string;
  invoiceId: string;
  amount: Millimes;
  kind: PaymentKind;
  /** Date de constatation du revenu : la plus tardive entre la prestation et le versement. */
  date: string;
};

export type InvoiceState = { paid: Millimes; remaining: Millimes; status: "PAID" | "PARTIAL" | "UNPAID" };

export type Ledger = {
  invoices: Map<string, InvoiceState>;
  allocations: Allocation[];
  /** Crédit restant par versement */
  lots: { paymentId: string; remaining: Millimes; kind: PaymentKind }[];
  totals: {
    billed: Millimes;
    paymentsReceived: Millimes; // paiements (hors avances)
    advancesReceived: Millimes;
    discounts: Millimes;
    refunded: Millimes;
    cashReceived: Millimes; // paiements + avances
    paidOnInvoices: Millimes; // toutes affectations (y c. remises)
    cashApplied: Millimes; // revenus encaissés (affectations d'argent réel)
    creditUsed: Millimes; // part des avances consommée par des séances
    credit: Millimes; // crédit disponible
    due: Millimes; // reste à payer
    /** solde net : crédit − reste à payer (positif = en avance) */
    net: Millimes;
  };
};

const ts = (v: Date | string | number) => (v instanceof Date ? v.getTime() : typeof v === "number" ? v : new Date(v).getTime());
const maxDate = (a: string, b: string) => (a > b ? a : b);

type Ev =
  | { t: "inv"; at: number; id: string; x: FInvoice }
  | { t: "pay"; at: number; id: string; x: FPayment }
  | { t: "ref"; at: number; id: string; x: FRefund };

export function computeLedger(invoices: FInvoice[], payments: FPayment[], refunds: FRefund[] = []): Ledger {
  const events: Ev[] = [
    ...invoices.filter((i) => !i.voided && i.amount > 0).map((x) => ({ t: "inv" as const, at: ts(x.createdAt), id: x.id, x })),
    ...payments.filter((p) => !p.voided && p.amount > 0).map((x) => ({ t: "pay" as const, at: ts(x.createdAt), id: x.id, x })),
    ...refunds.filter((r) => !r.voided && r.amount > 0).map((x) => ({ t: "ref" as const, at: ts(x.createdAt), id: x.id, x })),
  ];
  // Ordre réel de saisie ; à égalité, factures avant versements (un versement simultané règle la séance).
  const rank = { inv: 0, pay: 1, ref: 2 };
  events.sort((a, b) => a.at - b.at || rank[a.t] - rank[b.t] || (a.id < b.id ? -1 : 1));

  const open: { id: string; date: string; at: number; remaining: Millimes }[] = [];
  const lots: Ledger["lots"] = [];
  const allocations: Allocation[] = [];
  const payById = new Map(payments.map((p) => [p.id, p]));
  let refundShortfall = 0;

  const allocate = (p: FPayment, inv: { id: string; date: string; remaining: Millimes }, amount: Millimes) => {
    if (amount <= 0) return 0;
    const a = Math.min(amount, inv.remaining);
    inv.remaining -= a;
    allocations.push({ paymentId: p.id, invoiceId: inv.id, amount: a, kind: p.kind, date: maxDate(inv.date, p.date) });
    return a;
  };
  const sortOpen = () => open.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.at - b.at));
  const prune = () => {
    for (let i = open.length - 1; i >= 0; i--) if (open[i].remaining <= 0) open.splice(i, 1);
  };

  for (const e of events) {
    if (e.t === "inv") {
      const inv = { id: e.id, date: e.x.date, at: e.at, remaining: e.x.amount };
      // Consommer le crédit disponible, du plus ancien versement au plus récent
      for (const lot of lots) {
        if (inv.remaining <= 0) break;
        if (lot.remaining <= 0) continue;
        const used = allocate(payById.get(lot.paymentId)!, inv, lot.remaining);
        lot.remaining -= used;
      }
      if (inv.remaining > 0) {
        open.push(inv);
        sortOpen();
      }
    } else if (e.t === "pay") {
      let left = e.x.amount;
      // 1) factures explicitement ciblées (paiement groupé de plusieurs séances)
      for (const tid of e.x.targets ?? []) {
        const inv = open.find((o) => o.id === tid);
        if (inv && left > 0) left -= allocate(e.x, inv, left);
      }
      // 2) puis les plus anciennes factures impayées
      for (const inv of open) {
        if (left <= 0) break;
        left -= allocate(e.x, inv, left);
      }
      prune();
      // 3) le reste devient du crédit
      if (left > 0) lots.push({ paymentId: e.id, remaining: left, kind: e.x.kind });
    } else {
      // Remboursement : prélevé sur le crédit, du versement le plus récent au plus ancien
      let left = e.x.amount;
      for (let i = lots.length - 1; i >= 0 && left > 0; i--) {
        const take = Math.min(left, lots[i].remaining);
        lots[i].remaining -= take;
        left -= take;
      }
      refundShortfall += left; // remboursé au-delà du crédit (ex. versement annulé après coup) → dû
    }
  }

  const invStates = new Map<string, InvoiceState>();
  const live = invoices.filter((i) => !i.voided && i.amount > 0);
  const paidBy = new Map<string, number>();
  for (const a of allocations) paidBy.set(a.invoiceId, (paidBy.get(a.invoiceId) ?? 0) + a.amount);
  for (const i of live) {
    const paid = paidBy.get(i.id) ?? 0;
    const remaining = i.amount - paid;
    invStates.set(i.id, { paid, remaining, status: remaining <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID" });
  }

  const livePay = payments.filter((p) => !p.voided && p.amount > 0);
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);
  const billed = sum(live);
  const paidOnInvoices = sum(allocations);
  const cashApplied = sum(allocations.filter((a) => a.kind !== "DISCOUNT"));
  const creditUsed = sum(allocations.filter((a) => a.kind === "ADVANCE"));
  const credit = lots.reduce((s, l) => s + l.remaining, 0);
  const due = billed - paidOnInvoices + refundShortfall;

  return {
    invoices: invStates,
    allocations,
    lots: lots.filter((l) => l.remaining > 0),
    totals: {
      billed,
      paymentsReceived: sum(livePay.filter((p) => p.kind === "PAYMENT")),
      advancesReceived: sum(livePay.filter((p) => p.kind === "ADVANCE")),
      discounts: sum(livePay.filter((p) => p.kind === "DISCOUNT")),
      refunded: sum(refunds.filter((r) => !r.voided && r.amount > 0)),
      cashReceived: sum(livePay.filter((p) => p.kind !== "DISCOUNT")),
      paidOnInvoices,
      cashApplied,
      creditUsed,
      credit,
      due,
      net: credit - due,
    },
  };
}

// ───────────── Règles de facturation des séances ─────────────

export type BillingMode = "PER_SESSION" | "ADVANCE" | "MONTHLY";

export const BILLING_MODES: Record<BillingMode, string> = {
  PER_SESSION: "Paiement par séance",
  ADVANCE: "Avance / crédit",
  MONTHLY: "Forfait mensuel",
};

/**
 * Une séance doit-elle être facturée à cet élève ?
 *  - Effectuée : oui (sauf absence individuelle non facturable dans un groupe).
 *  - Absence de l'élève : seulement si l'absence tardive est déclarée facturable.
 *  - Annulée, reportée, absence de l'enseignante, prévue : jamais.
 *  - Forfait mensuel : jamais à la séance (le forfait est facturé au mois).
 */
export function isBillable(status: string, billingMode: string, opts: { lateAbsenceBillable?: boolean; individuallyAbsent?: boolean } = {}) {
  if (billingMode === "MONTHLY") return false;
  if (status === "DONE") return !opts.individuallyAbsent || !!opts.lateAbsenceBillable;
  if (status === "STUDENT_ABSENT") return !!opts.lateAbsenceBillable;
  return false;
}

/** Alertes de crédit pour un élève payant d'avance. */
export function creditAlert(credit: Millimes, due: Millimes, rate: Millimes): null | "INSUFFICIENT" | "LOW" {
  if (rate <= 0) return null;
  if (due > 0 || credit < rate) return "INSUFFICIENT";
  if (credit < rate * 2) return "LOW";
  return null;
}

/** Nombre de séances encore couvertes par le crédit. */
export const sessionsCovered = (credit: Millimes, rate: Millimes) => (rate > 0 ? Math.floor(credit / rate) : 0);
