import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { dateStr } from "@/lib/validation";
import { today } from "@/lib/dates";
import { createIncome } from "@/server/finance";

/** Marquer une séance comme payée (crée le revenu correspondant). */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const l = await prisma.lesson.findFirstOrThrow({ where: { id: params.id, userId: user.id } });
  const d = await body(req, z.object({ amount: z.number().positive().optional(), date: dateStr.optional(), method: z.enum(["CASH", "TRANSFER", "CARD", "CHECK", "OTHER"]).optional() }));
  if (l.incomeId) throw new HttpError(409, "Cette séance est déjà payée.");
  const amount = d.amount ?? l.price;
  if (!amount) throw new HttpError(400, "Indique le montant de la séance.");
  if (!l.price) await prisma.lesson.update({ where: { id: l.id }, data: { price: amount } });
  return createIncome(user.id, { date: d.date ?? today(), amount, source: "TUTORING", label: `${l.subject} — séance du ${l.date.split("-").reverse().slice(0, 2).join("/")}`, studentId: l.studentId, method: d.method ?? null, note: null, lessonIds: [l.id] });
});

/** Annuler le paiement d'une séance : retire la séance du paiement (et le paiement s'il ne couvrait qu'elle). */
export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  const l = await prisma.lesson.findFirstOrThrow({ where: { id: params.id, userId: user.id }, include: { income: { include: { lessons: { select: { id: true } } } } } });
  if (!l.income) return { ok: true };
  if (l.income.lessons.length <= 1) await prisma.income.delete({ where: { id: l.income.id } });
  else {
    await prisma.lesson.update({ where: { id: l.id }, data: { incomeId: null } });
    await prisma.income.update({ where: { id: l.income.id }, data: { amount: Math.max(0.01, Math.round((l.income.amount - (l.price ?? 0)) * 100) / 100) } });
  }
  return { ok: true };
});
