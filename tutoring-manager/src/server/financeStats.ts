import { prisma } from "@/lib/db";
import { ledgerFrom } from "./finance";
import { fromMil, toMil } from "@/lib/money";
import { addDays, monthOf, startOfWeek, today } from "@/lib/dates";

/**
 * Vue consolidée : toutes les affectations (revenus constatés), versements et créances.
 * Les revenus sont datés au moment où la prestation est à la fois réalisée et payée.
 */
export async function financeUniverse() {
  const [students, invoices, payments, refunds] = await Promise.all([
    prisma.student.findMany({ select: { id: true, firstName: true, lastName: true, levelId: true, archived: true, billingMode: true, rate: true } }),
    prisma.invoice.findMany({ include: { session: { select: { subjectId: true } } } }),
    prisma.payment.findMany({ include: { targets: true } }),
    prisma.refund.findMany(),
  ]);
  const by = <T extends { studentId: string }>(xs: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of xs) m.set(x.studentId, [...(m.get(x.studentId) ?? []), x]);
    return m;
  };
  const gi = by(invoices), gp = by(payments), gr = by(refunds);
  const invMeta = new Map(invoices.map((i) => [i.id, i]));
  const allocations: { studentId: string; subjectId: string | null; amount: number; date: string; kind: string; invoiceKind: string }[] = [];
  const perStudent = new Map<string, ReturnType<typeof ledgerFrom>>();
  for (const s of students) {
    const l = ledgerFrom(gi.get(s.id) ?? [], gp.get(s.id) ?? [], gr.get(s.id) ?? []);
    perStudent.set(s.id, l);
    for (const a of l.allocations) {
      const inv = invMeta.get(a.invoiceId)!;
      allocations.push({ studentId: s.id, subjectId: inv.session?.subjectId ?? null, amount: a.amount, date: a.date, kind: a.kind, invoiceKind: inv.kind });
    }
  }
  return { students, invoices, payments, refunds, allocations, perStudent };
}

export async function financeStats(range: { from: string; to: string }) {
  const u = await financeUniverse();
  const cash = u.allocations.filter((a) => a.kind !== "DISCOUNT");
  const inRange = cash.filter((a) => a.date >= range.from && a.date <= range.to);
  const sum = (xs: { amount: number }[]) => fromMil(xs.reduce((s, x) => s + x.amount, 0));
  const t = today();
  const ws = startOfWeek(t);

  const byMonth = new Map<string, { revenue: number; received: number; billed: number }>();
  const bump = (m: string, k: "revenue" | "received" | "billed", v: number) => {
    const cur = byMonth.get(m) ?? { revenue: 0, received: 0, billed: 0 };
    cur[k] += v;
    byMonth.set(m, cur);
  };
  for (const a of cash) bump(monthOf(a.date), "revenue", a.amount);
  for (const p of u.payments.filter((p) => !p.voidedAt && p.kind !== "DISCOUNT")) bump(monthOf(p.date), "received", toMil(p.amount));
  for (const i of u.invoices.filter((i) => !i.voidedAt)) bump(monthOf(i.date), "billed", toMil(i.amount));
  const months = [...byMonth.keys()].filter((m) => m >= range.from.slice(0, 7) && m <= range.to.slice(0, 7)).sort();

  const byDay = new Map<string, number>();
  for (const a of inRange) byDay.set(a.date, (byDay.get(a.date) ?? 0) + a.amount);

  const studentName = new Map(u.students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
  const byStudent = new Map<string, number>();
  for (const a of inRange) byStudent.set(a.studentId, (byStudent.get(a.studentId) ?? 0) + a.amount);
  const subjects = await prisma.subject.findMany({ select: { id: true, name: true, color: true } });
  const subj = new Map(subjects.map((s) => [s.id, s]));
  const bySubject = new Map<string, number>();
  for (const a of inRange) {
    const k = a.subjectId ?? (a.invoiceKind === "PACKAGE" ? "__package" : "__other");
    bySubject.set(k, (bySubject.get(k) ?? 0) + a.amount);
  }

  let credit = 0, due = 0;
  for (const l of u.perStudent.values()) {
    credit += l.totals.credit;
    due += l.totals.due;
  }
  const liveRefunds = u.refunds.filter((r) => !r.voidedAt);
  const livePay = u.payments.filter((p) => !p.voidedAt && p.kind !== "DISCOUNT");

  return {
    range,
    totals: {
      revenueToday: sum(cash.filter((a) => a.date === t)),
      revenueWeek: sum(cash.filter((a) => a.date >= ws && a.date <= addDays(ws, 6))),
      revenueMonth: sum(cash.filter((a) => monthOf(a.date) === monthOf(t))),
      revenueYear: sum(cash.filter((a) => a.date.slice(0, 4) === t.slice(0, 4))),
      revenueRange: sum(inRange),
      receivedRange: fromMil(livePay.filter((p) => p.date >= range.from && p.date <= range.to).reduce((s, p) => s + toMil(p.amount), 0)),
      creditAvailable: fromMil(credit),
      receivables: fromMil(due),
      refundedRange: fromMil(liveRefunds.filter((r) => r.date >= range.from && r.date <= range.to).reduce((s, r) => s + toMil(r.amount), 0)),
      refundedAll: fromMil(liveRefunds.reduce((s, r) => s + toMil(r.amount), 0)),
    },
    months: months.map((m) => ({ month: m, revenue: fromMil(byMonth.get(m)!.revenue), received: fromMil(byMonth.get(m)!.received), billed: fromMil(byMonth.get(m)!.billed) })),
    days: [...byDay.entries()].sort().map(([date, v]) => ({ date, revenue: fromMil(v) })),
    byStudent: [...byStudent.entries()].map(([id, v]) => ({ id, name: studentName.get(id) ?? "?", revenue: fromMil(v) })).sort((a, b) => b.revenue - a.revenue),
    bySubject: [...bySubject.entries()]
      .map(([id, v]) => ({ id, name: id === "__package" ? "Forfaits mensuels" : id === "__other" ? "Autres / corrections" : subj.get(id)?.name ?? "?", color: subj.get(id)?.color ?? "#cfd6e4", revenue: fromMil(v) }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}
