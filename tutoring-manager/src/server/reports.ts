import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { allStudentFinances } from "./finance";
import { fromMil, toMil } from "@/lib/money";
import { daysBetween, monthOf, today } from "@/lib/dates";
import { readSettings } from "@/lib/settings";

export async function transactionsQuery(p: URLSearchParams) {
  const where: Prisma.FinancialTransactionWhereInput = {
    ...(p.get("studentId") ? { studentId: p.get("studentId")! } : {}),
    ...(p.get("type") ? { type: { in: p.get("type")!.split(",") } } : {}),
    date: { gte: p.get("from") ?? undefined, lte: p.get("to") ?? undefined },
  };
  const take = Math.min(Number(p.get("take") ?? 100), 5000);
  const skip = Number(p.get("skip") ?? 0);
  const [items, total] = await Promise.all([
    prisma.financialTransaction.findMany({
      where,
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.financialTransaction.count({ where }),
  ]);
  return { items, total };
}

/** Tableau financier général (une ligne par élève) avec filtres. */
export async function financeOverview(p: URLSearchParams) {
  const user = await prisma.user.findFirst();
  const lateDays = readSettings(user?.settings).notifications.pendingPaymentDays;
  const where: Prisma.StudentWhereInput = {
    ...(p.get("archived") === "1" ? {} : { archived: false }),
    ...(p.get("studentId") ? { id: p.get("studentId")! } : {}),
    ...(p.get("levelId") ? { levelId: p.get("levelId")! } : {}),
    ...(p.get("subjectId") ? { subjects: { some: { subjectId: p.get("subjectId")! } } } : {}),
  };
  const month = p.get("month");
  const rows = await allStudentFinances(where);
  const t = today();
  let invoicesByStudent = new Map<string, { id: string; date: string; amount: Prisma.Decimal; voidedAt: Date | null }[]>();
  if (month) {
    const inv = await prisma.invoice.findMany({ where: { studentId: { in: rows.map((r) => r.student.id) }, voidedAt: null, date: { startsWith: month } } });
    invoicesByStudent = new Map();
    for (const i of inv) invoicesByStudent.set(i.studentId, [...(invoicesByStudent.get(i.studentId) ?? []), i]);
  }
  const out = rows.map(({ student: s, finance: f }) => {
    let billed = f.billed, paid = f.paidOnInvoices, due = f.due;
    if (month) {
      const inv = invoicesByStudent.get(s.id) ?? [];
      billed = fromMil(inv.reduce((a, i) => a + toMil(i.amount), 0));
      paid = fromMil(inv.reduce((a, i) => a + (f.ledger.invoices.get(i.id)?.paid ?? 0), 0));
      due = fromMil(inv.reduce((a, i) => a + (f.ledger.invoices.get(i.id)?.remaining ?? 0), 0));
    }
    const late = !!f.oldestUnpaid && daysBetween(f.oldestUnpaid, t) > lateDays;
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      level: s.level?.name ?? null,
      subjects: s.subjects.map((x) => x.subject.name),
      billingMode: s.billingMode,
      rate: f.rate,
      sessionsDone: f.sessionsDone,
      sessionsBilled: f.sessionsBilled,
      sessionsPaid: f.sessionsPaid,
      billed,
      paid,
      payments: f.paymentsReceived,
      advances: f.advancesReceived,
      credit: f.credit,
      due,
      totalDue: f.due,
      oldestUnpaid: f.oldestUnpaid ?? null,
      late,
      status: f.due > 0 ? (late ? "LATE" : "DUE") : f.credit > 0 ? "CREDIT" : "SETTLED",
    };
  });
  const status = p.get("status");
  const filtered = status ? out.filter((r) => (status === "DUE" ? r.totalDue > 0 : r.status === status)) : out;
  const sum = (k: "billed" | "paid" | "credit" | "due") => fromMil(filtered.reduce((a, r) => a + toMil(r[k]), 0));
  return { month: month ?? null, currentMonth: monthOf(t), rows: filtered, totals: { billed: sum("billed"), paid: sum("paid"), credit: sum("credit"), due: sum("due") } };
}
