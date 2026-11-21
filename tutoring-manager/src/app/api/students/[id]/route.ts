import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, body, fail } from "@/lib/api";
import { studentSchema } from "@/lib/validation";
import { updateStudent } from "@/server/students";
import { summarize } from "@/server/finance";
import { creditAlert, sessionsCovered } from "@/lib/finance";
import { fromMil, toMil } from "@/lib/money";

type P = { id: string };

export const GET = route<P>(async ({ params }) => {
  const s = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      level: true,
      parent: { include: { students: { select: { id: true, firstName: true, lastName: true } } } },
      subjects: { include: { subject: true } },
      packages: { orderBy: { startMonth: "desc" } },
      invoices: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      payments: { include: { targets: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      refunds: { orderBy: { date: "desc" } },
      transactions: { orderBy: { createdAt: "desc" } },
      progress: { include: { chapter: { include: { subject: true, level: true } } } },
      assessments: { include: { subject: true }, orderBy: { date: "asc" } },
      homework: { include: { subject: true }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
      documents: { select: { id: true, name: true, type: true, mimeType: true, size: true, url: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      participations: {
        include: { session: { include: { subject: true, lessons: { include: { lesson: { select: { id: true, title: true } } } } } } },
        orderBy: { session: { date: "desc" } },
      },
    },
  });
  if (!s) fail(404, "Élève introuvable.");
  const st = s!;
  const done = st.participations.filter((p) => p.session.status === "DONE" && !p.absent).length;
  const f = summarize(st, st.invoices, st.payments, st.refunds, done);
  const alert = st.billingMode === "ADVANCE" ? creditAlert(toMil(f.credit), toMil(f.due), toMil(st.rate)) : null;
  return {
    ...st,
    subjects: st.subjects.map((x) => x.subject),
    // État de chaque facture, converti des millimes en dinars
    invoices: st.invoices.map((i) => {
      const x = i.voidedAt ? null : f.ledger.invoices.get(i.id);
      return { ...i, state: x ? { paid: fromMil(x.paid), remaining: fromMil(x.remaining), status: x.status } : null };
    }),
    finance: { ...f, ledger: undefined, alert, sessionsCovered: sessionsCovered(toMil(f.credit), toMil(st.rate)) },
    sessions: st.participations.map((p) => ({ ...p.session, price: p.price, absent: p.absent })),
    participations: undefined,
  };
});

export const PUT = route<P>(async ({ req, params }) => updateStudent(params.id, await body(req, studentSchema)));

export const PATCH = route<P>(async ({ req, params }) => {
  const v = await body(req, z.object({ archived: z.boolean() }));
  return prisma.student.update({ where: { id: params.id }, data: { archived: v.archived, archivedAt: v.archived ? new Date() : null } });
});

// Suppression définitive seulement sans historique financier ; sinon : archiver.
export const DELETE = route<P>(async ({ params }) => {
  const [inv, pay, tx] = await Promise.all([
    prisma.invoice.count({ where: { studentId: params.id } }),
    prisma.payment.count({ where: { studentId: params.id } }),
    prisma.financialTransaction.count({ where: { studentId: params.id } }),
  ]);
  if (inv + pay + tx > 0) fail(409, "Cet élève a un historique financier : il ne peut pas être supprimé, archivez-le plutôt.");
  await prisma.$transaction(async (tx) => {
    const sessions = await tx.sessionParticipant.findMany({ where: { studentId: params.id }, select: { sessionId: true } });
    await tx.student.delete({ where: { id: params.id } });
    // Séances qui n'ont plus aucun élève
    await tx.session.deleteMany({ where: { id: { in: sessions.map((s) => s.sessionId) }, participants: { none: {} } } });
  });
});
