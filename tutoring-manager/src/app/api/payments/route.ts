import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, body, qs } from "@/lib/api";
import { paymentSchema } from "@/lib/validation";
import { financeTx, recordPayment } from "@/server/finance";

export const GET = route(async ({ req }) => {
  const p = qs(req);
  const where: Prisma.PaymentWhereInput = {
    ...(p.get("studentId") ? { studentId: p.get("studentId")! } : {}),
    ...(p.get("kind") ? { kind: p.get("kind")! } : {}),
    ...(p.get("method") ? { method: p.get("method")! } : {}),
    date: { gte: p.get("from") ?? undefined, lte: p.get("to") ?? undefined },
    ...(p.get("voided") === "1" ? {} : { voidedAt: null }),
  };
  return prisma.payment.findMany({
    where,
    include: { student: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: Math.min(Number(p.get("take") ?? 300), 2000),
  });
});

export const POST = route(async ({ req }) => {
  const v = await body(req, paymentSchema);
  return financeTx((tx) => recordPayment(tx, v));
});
