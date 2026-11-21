// Opérations financières en base. Chaque opération :
//  1. s'exécute dans une transaction PostgreSQL ;
//  2. verrouille l'élève concerné (pg_advisory_xact_lock) : deux saisies simultanées
//     ne peuvent pas produire un solde incohérent ;
//  3. écrit une ligne immuable dans le journal (FinancialTransaction) avec la
//     situation de l'élève juste après.

import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { computeLedger, isBillable, type FPayment, type Ledger, type PaymentKind } from "@/lib/finance";
import { fromMil, milToDecimalString, toMil, formatDT } from "@/lib/money";
import { today } from "@/lib/dates";
import { SESSION_STATUS } from "@/lib/constants";

const dec = (m: number) => new Prisma.Decimal(milToDecimalString(m));

// Horodatage strictement croissant : l'ordre de saisie détermine les affectations.
let lastTs = 0;
export function seqNow() {
  const n = Math.max(Date.now(), lastTs + 1);
  lastTs = n;
  return new Date(n);
}

export async function lockStudent(tx: Tx, studentId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`;
}

/** Transaction sérialisée pour les opérations financières. */
export function financeTx<T>(fn: (tx: Tx) => Promise<T>) {
  return prisma.$transaction((tx) => fn(tx), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20000 });
}

type InvRow = { id: string; date: string; amount: Prisma.Decimal; createdAt: Date; voidedAt: Date | null; kind: string };
type PayRow = { id: string; kind: string; date: string; amount: Prisma.Decimal; createdAt: Date; voidedAt: Date | null; targets: { invoiceId: string; order: number }[] };
type RefRow = { id: string; date: string; amount: Prisma.Decimal; createdAt: Date; voidedAt: Date | null };

export function ledgerFrom(invoices: InvRow[], payments: PayRow[], refunds: RefRow[]): Ledger {
  return computeLedger(
    invoices.map((i) => ({ id: i.id, date: i.date, amount: toMil(i.amount), createdAt: i.createdAt, voided: !!i.voidedAt, kind: i.kind })),
    payments.map(
      (p): FPayment => ({
        id: p.id,
        kind: p.kind as PaymentKind,
        date: p.date,
        amount: toMil(p.amount),
        createdAt: p.createdAt,
        voided: !!p.voidedAt,
        targets: [...p.targets].sort((a, b) => a.order - b.order).map((t) => t.invoiceId),
      }),
    ),
    refunds.map((r) => ({ id: r.id, date: r.date, amount: toMil(r.amount), createdAt: r.createdAt, voided: !!r.voidedAt })),
  );
}

export async function loadLedger(db: Tx, studentId: string) {
  const [invoices, payments, refunds] = await Promise.all([
    db.invoice.findMany({ where: { studentId } }),
    db.payment.findMany({ where: { studentId }, include: { targets: true } }),
    db.refund.findMany({ where: { studentId } }),
  ]);
  return { ledger: ledgerFrom(invoices, payments, refunds), invoices, payments, refunds };
}

async function log(
  tx: Tx,
  studentId: string,
  e: { type: string; amount: number; date: string; description: string; invoiceId?: string; paymentId?: string; refundId?: string; sessionId?: string | null; isDemo?: boolean },
) {
  const { ledger } = await loadLedger(tx, studentId);
  await tx.financialTransaction.create({
    data: {
      studentId,
      type: e.type,
      amount: dec(e.amount),
      date: e.date,
      description: e.description,
      invoiceId: e.invoiceId,
      paymentId: e.paymentId,
      refundId: e.refundId,
      sessionId: e.sessionId ?? undefined,
      dueAfter: dec(ledger.totals.due),
      creditAfter: dec(ledger.totals.credit),
      isDemo: e.isDemo ?? false,
      createdAt: seqNow(),
    },
  });
  return ledger;
}

/** Après création d'une facture : journaliser le crédit consommé automatiquement. */
async function logCreditUse(tx: Tx, studentId: string, invoiceId: string, date: string, label: string, isDemo = false) {
  const { ledger } = await loadLedger(tx, studentId);
  const used = ledger.allocations.filter((a) => a.invoiceId === invoiceId && a.kind === "ADVANCE").reduce((s, a) => s + a.amount, 0);
  if (used > 0) await log(tx, studentId, { type: "CREDIT_USED", amount: used, date, description: `Crédit utilisé — ${label}`, invoiceId, isDemo });
}

async function voidInvoiceRow(tx: Tx, inv: { id: string; studentId: string; amount: Prisma.Decimal; label: string; sessionId: string | null; isDemo: boolean }, reason: string) {
  await tx.invoice.update({ where: { id: inv.id }, data: { voidedAt: seqNow(), voidReason: reason } });
  await log(tx, inv.studentId, {
    type: "INVOICE_VOIDED",
    amount: toMil(inv.amount),
    date: today(),
    description: `Annulation : ${inv.label} — ${reason}`,
    invoiceId: inv.id,
    sessionId: inv.sessionId,
    isDemo: inv.isDemo,
  });
}

// ───────────── Facturation des séances ─────────────

/**
 * Met la facturation d'une séance en accord avec son statut, pour chaque élève :
 * crée la facture manquante, annule (avec trace) celle qui n'a plus lieu d'être,
 * ou la remplace si le tarif a changé. Idempotent : aucune double facturation.
 */
export async function syncSessionBilling(tx: Tx, sessionId: string) {
  const s = await tx.session.findUnique({
    where: { id: sessionId },
    include: { participants: { include: { student: true } }, subject: true, invoices: { where: { voidedAt: null } } },
  });
  if (!s) return;
  const participantIds = new Set(s.participants.map((p) => p.studentId));
  const studentIds = new Set([...participantIds, ...s.invoices.map((i) => i.studentId)]);
  for (const studentId of [...studentIds].sort()) await lockStudent(tx, studentId);

  // Élève retiré de la séance : annuler sa facture
  for (const inv of s.invoices.filter((i) => !participantIds.has(i.studentId))) await voidInvoiceRow(tx, inv, "élève retiré de la séance");

  for (const p of s.participants) {
    const billable = isBillable(s.status, p.student.billingMode, { lateAbsenceBillable: s.lateAbsenceBillable, individuallyAbsent: p.absent });
    const existing = s.invoices.find((i) => i.studentId === p.studentId);
    const amount = toMil(p.price);
    if (existing && (!billable || toMil(existing.amount) !== amount || amount <= 0)) {
      const reason = !billable ? `séance « ${SESSION_STATUS[s.status].label.toLowerCase()} »${p.absent ? " (absent)" : ""}` : "tarif modifié";
      await voidInvoiceRow(tx, existing, reason);
    }
    const stillValid = existing && billable && toMil(existing.amount) === amount && amount > 0;
    if (billable && amount > 0 && !stillValid) {
      const label = `Séance du ${s.date.split("-").reverse().join("/")} ${s.startTime}${s.subject ? ` · ${s.subject.name}` : ""}${s.status === "STUDENT_ABSENT" || p.absent ? " (absence facturée)" : ""}`;
      const inv = await tx.invoice.create({
        data: { studentId: p.studentId, kind: "SESSION", sessionId: s.id, date: s.date, label, amount: p.price, isDemo: s.isDemo, createdAt: seqNow() },
      });
      await log(tx, p.studentId, { type: "SESSION_BILLED", amount, date: s.date, description: label, invoiceId: inv.id, sessionId: s.id, isDemo: s.isDemo });
      await logCreditUse(tx, p.studentId, inv.id, s.date, label, s.isDemo);
    }
  }
}

// ───────────── Forfaits mensuels ─────────────

export async function billPackage(tx: Tx, studentId: string, month: string) {
  await lockStudent(tx, studentId);
  const pkg = await tx.package.findFirst({
    where: { studentId, active: true, startMonth: { lte: month }, OR: [{ endMonth: null }, { endMonth: { gte: month } }] },
    orderBy: { startMonth: "desc" },
  });
  if (!pkg) throw new HttpError(400, "Aucun forfait actif pour ce mois. Créez d'abord un forfait sur la fiche de l'élève.");
  const exists = await tx.invoice.findFirst({ where: { studentId, kind: "PACKAGE", month, voidedAt: null } });
  if (exists) throw new HttpError(409, "Le forfait de ce mois est déjà facturé.");
  const label = `${pkg.name} — ${month.split("-").reverse().join("/")}`;
  const inv = await tx.invoice.create({
    data: { studentId, kind: "PACKAGE", packageId: pkg.id, month, date: `${month}-01`, label, amount: pkg.amount, isDemo: pkg.isDemo, createdAt: seqNow() },
  });
  await log(tx, studentId, { type: "PACKAGE_BILLED", amount: toMil(pkg.amount), date: `${month}-01`, description: label, invoiceId: inv.id, isDemo: pkg.isDemo });
  await logCreditUse(tx, studentId, inv.id, `${month}-01`, label, pkg.isDemo);
  return inv;
}

// ───────────── Versements ─────────────

async function nextReceiptNo(tx: Tx, date: string) {
  const year = date.slice(0, 4);
  const c = await tx.counter.upsert({ where: { key: `receipt-${year}` }, create: { key: `receipt-${year}`, value: 1 }, update: { value: { increment: 1 } } });
  return `R-${year}-${String(c.value).padStart(4, "0")}`;
}

export type PaymentInput = {
  studentId: string;
  kind: PaymentKind;
  date: string;
  amount: number; // dinars
  method: string;
  reason?: string | null;
  reference?: string | null;
  notes?: string | null;
  targetInvoiceIds?: string[];
  isDemo?: boolean;
};

export async function recordPayment(tx: Tx, input: PaymentInput) {
  await lockStudent(tx, input.studentId);
  const student = await tx.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw new HttpError(404, "Élève introuvable.");
  const amount = toMil(input.amount);
  if (amount <= 0) throw new HttpError(400, "Le montant doit être supérieur à 0.");

  const { ledger, invoices } = await loadLedger(tx, input.studentId);
  const targets = (input.targetInvoiceIds ?? []).filter((id) => {
    const inv = invoices.find((i) => i.id === id);
    return inv && !inv.voidedAt && (ledger.invoices.get(id)?.remaining ?? 0) > 0;
  });
  if (input.kind === "DISCOUNT" && amount > ledger.totals.due) throw new HttpError(400, `Une remise ne peut pas dépasser le reste à payer (${formatDT(fromMil(ledger.totals.due))}).`);

  // Doublon probable (même montant, même date, saisi il y a moins de 2 minutes)
  const recent = await tx.payment.findFirst({
    where: { studentId: input.studentId, amount: dec(amount), date: input.date, kind: input.kind, voidedAt: null, createdAt: { gte: new Date(Date.now() - 120_000) } },
  });
  if (recent) throw new HttpError(409, "Ce versement vient déjà d'être enregistré (doublon évité).");

  const payment = await tx.payment.create({
    data: {
      studentId: input.studentId,
      kind: input.kind,
      date: input.date,
      amount: dec(amount),
      method: input.kind === "DISCOUNT" ? "OTHER" : input.method,
      reason: input.reason || null,
      reference: input.reference || null,
      notes: input.notes || null,
      receiptNo: input.kind === "DISCOUNT" ? null : await nextReceiptNo(tx, input.date),
      isDemo: input.isDemo ?? student.isDemo,
      createdAt: seqNow(),
      targets: { create: targets.map((invoiceId, order) => ({ invoiceId, order })) },
    },
  });
  const type = input.kind === "ADVANCE" ? "ADVANCE_RECEIVED" : input.kind === "DISCOUNT" ? "DISCOUNT" : "PAYMENT_RECEIVED";
  const label = input.kind === "ADVANCE" ? "Avance reçue" : input.kind === "DISCOUNT" ? "Remise accordée" : "Paiement reçu";
  await log(tx, input.studentId, {
    type,
    amount,
    date: input.date,
    description: `${label}${input.reason ? ` — ${input.reason}` : ""}${targets.length ? ` (${targets.length} séance(s) ciblée(s))` : ""}`,
    paymentId: payment.id,
    isDemo: payment.isDemo,
  });
  return payment;
}

export async function voidPayment(tx: Tx, paymentId: string, reason: string) {
  const p = await tx.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw new HttpError(404, "Versement introuvable.");
  if (p.voidedAt) throw new HttpError(409, "Ce versement est déjà annulé.");
  await lockStudent(tx, p.studentId);
  await tx.payment.update({ where: { id: p.id }, data: { voidedAt: seqNow(), voidReason: reason } });
  await log(tx, p.studentId, { type: "PAYMENT_VOIDED", amount: toMil(p.amount), date: today(), description: `Annulation du versement ${p.receiptNo ?? ""} du ${p.date.split("-").reverse().join("/")} — ${reason}`, paymentId: p.id, isDemo: p.isDemo });
}

export async function recordRefund(tx: Tx, input: { studentId: string; date: string; amount: number; method: string; reason?: string | null }) {
  await lockStudent(tx, input.studentId);
  const amount = toMil(input.amount);
  const { ledger } = await loadLedger(tx, input.studentId);
  if (amount <= 0) throw new HttpError(400, "Le montant doit être supérieur à 0.");
  if (amount > ledger.totals.credit) throw new HttpError(400, `Remboursement impossible : le crédit disponible n'est que de ${formatDT(fromMil(ledger.totals.credit))}.`);
  const student = await tx.student.findUniqueOrThrow({ where: { id: input.studentId } });
  const r = await tx.refund.create({ data: { studentId: input.studentId, date: input.date, amount: dec(amount), method: input.method, reason: input.reason || null, isDemo: student.isDemo, createdAt: seqNow() } });
  await log(tx, input.studentId, { type: "REFUND", amount, date: input.date, description: `Remboursement${input.reason ? ` — ${input.reason}` : ""}`, refundId: r.id, isDemo: r.isDemo });
  return r;
}

export async function voidRefund(tx: Tx, refundId: string, reason: string) {
  const r = await tx.refund.findUnique({ where: { id: refundId } });
  if (!r) throw new HttpError(404, "Remboursement introuvable.");
  if (r.voidedAt) throw new HttpError(409, "Déjà annulé.");
  await lockStudent(tx, r.studentId);
  await tx.refund.update({ where: { id: r.id }, data: { voidedAt: seqNow(), voidReason: reason } });
  await log(tx, r.studentId, { type: "REFUND_VOIDED", amount: toMil(r.amount), date: today(), description: `Annulation du remboursement du ${r.date.split("-").reverse().join("/")} — ${reason}`, refundId: r.id, isDemo: r.isDemo });
}

/** Correction : ajout de frais (créance supplémentaire). Pour réduire une dette, utiliser une remise. */
export async function addAdjustment(tx: Tx, input: { studentId: string; date: string; amount: number; label: string }) {
  await lockStudent(tx, input.studentId);
  const amount = toMil(input.amount);
  if (amount <= 0) throw new HttpError(400, "Le montant doit être supérieur à 0.");
  const student = await tx.student.findUniqueOrThrow({ where: { id: input.studentId } });
  const inv = await tx.invoice.create({ data: { studentId: input.studentId, kind: "ADJUSTMENT", date: input.date, label: input.label, amount: dec(amount), isDemo: student.isDemo, createdAt: seqNow() } });
  await log(tx, input.studentId, { type: "ADJUSTMENT", amount, date: input.date, description: `Correction : ${input.label}`, invoiceId: inv.id, isDemo: inv.isDemo });
  await logCreditUse(tx, input.studentId, inv.id, input.date, input.label, inv.isDemo);
  return inv;
}

/** Annulation manuelle d'un forfait ou d'une correction. Les séances s'annulent via leur statut. */
export async function voidInvoice(tx: Tx, invoiceId: string, reason: string) {
  const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) throw new HttpError(404, "Facture introuvable.");
  if (inv.voidedAt) throw new HttpError(409, "Déjà annulée.");
  if (inv.kind === "SESSION") throw new HttpError(400, "Pour ne plus facturer une séance, changez son statut (annulée, reportée…) ou accordez une remise.");
  await lockStudent(tx, inv.studentId);
  await voidInvoiceRow(tx, inv, reason);
}

// ───────────── Synthèses ─────────────

export type StudentFinance = ReturnType<typeof summarize>;

export function summarize(
  student: { id: string; rate: Prisma.Decimal; billingMode: string },
  invoices: InvRow[],
  payments: PayRow[],
  refunds: RefRow[],
  sessionsDone: number,
) {
  const ledger = ledgerFrom(invoices, payments, refunds);
  const live = invoices.filter((i) => !i.voidedAt);
  const sessionInv = live.filter((i) => i.kind === "SESSION");
  const t = ledger.totals;
  return {
    ledger,
    rate: fromMil(toMil(student.rate)),
    billingMode: student.billingMode,
    sessionsDone,
    sessionsBilled: sessionInv.length,
    sessionsPaid: sessionInv.filter((i) => ledger.invoices.get(i.id)?.status === "PAID").length,
    billed: fromMil(t.billed),
    paymentsReceived: fromMil(t.paymentsReceived),
    advancesReceived: fromMil(t.advancesReceived),
    discounts: fromMil(t.discounts),
    refunded: fromMil(t.refunded),
    paidOnInvoices: fromMil(t.paidOnInvoices),
    revenue: fromMil(t.cashApplied),
    creditUsed: fromMil(t.creditUsed),
    credit: fromMil(t.credit),
    due: fromMil(t.due),
    oldestUnpaid: live
      .filter((i) => (ledger.invoices.get(i.id)?.remaining ?? 0) > 0)
      .map((i) => i.date)
      .sort()[0] as string | undefined,
  };
}

/** Situation financière de tous les élèves (une seule série de requêtes). */
export async function allStudentFinances(where: Prisma.StudentWhereInput = {}) {
  const students = await prisma.student.findMany({
    where,
    include: { level: true, subjects: { include: { subject: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const ids = students.map((s) => s.id);
  const [invoices, payments, refunds, done] = await Promise.all([
    prisma.invoice.findMany({ where: { studentId: { in: ids } } }),
    prisma.payment.findMany({ where: { studentId: { in: ids } }, include: { targets: true } }),
    prisma.refund.findMany({ where: { studentId: { in: ids } } }),
    prisma.sessionParticipant.groupBy({ by: ["studentId"], where: { studentId: { in: ids }, absent: false, session: { status: "DONE" } }, _count: true }),
  ]);
  const group = <T extends { studentId: string }>(xs: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of xs) m.set(x.studentId, [...(m.get(x.studentId) ?? []), x]);
    return m;
  };
  const gi = group(invoices), gp = group(payments), gr = group(refunds);
  const gd = new Map(done.map((d) => [d.studentId, d._count]));
  return students.map((s) => ({ student: s, finance: summarize(s, gi.get(s.id) ?? [], gp.get(s.id) ?? [], gr.get(s.id) ?? [], gd.get(s.id) ?? 0) }));
}
