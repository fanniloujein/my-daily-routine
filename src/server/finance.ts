import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { addMonthsStr, monthOf, monthSituation, unpaidLessons } from "@/lib/billing";
import { today } from "@/lib/dates";

/** Tableau de bord des paiements des cours pour un mois donné. */
export async function financeSummary(userId: string, month: string) {
  const [students, incomes] = await Promise.all([
    prisma.student.findMany({
      where: { userId },
      orderBy: [{ isGroup: "asc" }, { name: "asc" }],
      include: {
        lessons: { select: { id: true, date: true, startTime: true, endTime: true, subject: true, status: true, price: true, incomeId: true }, orderBy: [{ date: "asc" }, { startTime: "asc" }] },
        members: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.income.findMany({ where: { userId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { student: { select: { id: true, name: true, color: true, isGroup: true } }, lessons: { select: { id: true, date: true } } } }),
  ]);

  const rows = students
    .map((s) => {
      const monthlyPaid = incomes.filter((i) => i.studentId === s.id && i.period === month).reduce((a, i) => a + i.amount, 0);
      const sit = monthSituation(s, s.lessons, monthlyPaid, month);
      const unpaid = s.billingMode === "MONTH" ? [] : unpaidLessons(s.lessons);
      // Forfaits mensuels impayés sur les 12 derniers mois
      const unpaidMonths: { month: string; due: number; paid: number }[] = [];
      if (s.billingMode === "MONTH" && s.rate) {
        for (let i = 0; i < 12; i++) {
          const m = addMonthsStr(monthOf(today()), -i);
          const paid = incomes.filter((x) => x.studentId === s.id && x.period === m).reduce((a, x) => a + x.amount, 0);
          const has = s.lessons.some((l) => monthOf(l.date) === m && l.status === "DONE");
          if (has && paid < s.rate) unpaidMonths.push({ month: m, due: s.rate, paid });
        }
      }
      const outstanding = unpaid.reduce((a, l) => a + (l.price ?? 0), 0) + unpaidMonths.reduce((a, m) => a + (m.due - m.paid), 0);
      const totalPaid = incomes.filter((i) => i.studentId === s.id).reduce((a, i) => a + i.amount, 0);
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        isGroup: s.isGroup,
        archived: s.archived,
        members: s.members,
        billingMode: s.billingMode,
        rate: s.rate,
        month: sit,
        unpaidLessons: unpaid.map((l) => ({ id: l.id, date: l.date, startTime: l.startTime, subject: l.subject, price: l.price ?? 0 })),
        unpaidMonths,
        outstanding: Math.round(outstanding * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
      };
    })
    .filter((r) => !r.archived || r.outstanding > 0 || r.month.sessions > 0);

  const receivedMonth = incomes.filter((i) => monthOf(i.date) === month);
  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const m = addMonthsStr(month, i - 11);
    const list = incomes.filter((x) => monthOf(x.date) === m);
    return {
      month: m,
      total: list.reduce((a, x) => a + x.amount, 0),
      tutoring: list.filter((x) => x.source === "TUTORING").reduce((a, x) => a + x.amount, 0),
      freelance: list.filter((x) => x.source === "FREELANCE").reduce((a, x) => a + x.amount, 0),
      other: list.filter((x) => x.source === "OTHER").reduce((a, x) => a + x.amount, 0),
    };
  });

  return {
    month,
    rows,
    totals: {
      receivedMonth: receivedMonth.reduce((a, i) => a + i.amount, 0),
      receivedTutoringMonth: receivedMonth.filter((i) => i.source === "TUTORING").reduce((a, i) => a + i.amount, 0),
      dueMonth: rows.reduce((a, r) => a + r.month.due, 0),
      outstanding: rows.reduce((a, r) => a + r.outstanding, 0),
      receivedYear: incomes.filter((i) => i.date.slice(0, 4) === month.slice(0, 4)).reduce((a, i) => a + i.amount, 0),
    },
    byMonth,
    incomes: incomes.slice(0, 200).map((i) => ({ ...i, lessonCount: i.lessons.length })),
  };
}

/** Enregistre un paiement (revenu) et y rattache les séances réglées. */
export async function createIncome(
  userId: string,
  d: { date: string; amount: number; source: string; label: string | null; studentId?: string | null; period?: string | null; method?: string | null; note: string | null; lessonIds: string[] },
) {
  if (d.studentId) {
    const st = await prisma.student.findFirst({ where: { id: d.studentId, userId } });
    if (!st) throw new HttpError(404, "Élève introuvable");
  }
  if (d.lessonIds.length) {
    const ok = await prisma.lesson.count({ where: { id: { in: d.lessonIds }, userId, incomeId: null, ...(d.studentId ? { studentId: d.studentId } : {}) } });
    if (ok !== new Set(d.lessonIds).size) throw new HttpError(400, "Certaines séances sont introuvables ou déjà payées.");
  }
  return prisma.$transaction(async (tx) => {
    const income = await tx.income.create({
      data: {
        userId,
        date: d.date,
        amount: d.amount,
        source: d.studentId ? "TUTORING" : d.source,
        label: d.label,
        studentId: d.studentId ?? null,
        period: d.period ?? null,
        method: d.method ?? null,
        note: d.note,
      },
    });
    if (d.lessonIds.length) await tx.lesson.updateMany({ where: { id: { in: d.lessonIds }, userId }, data: { incomeId: income.id } });
    return income;
  });
}
