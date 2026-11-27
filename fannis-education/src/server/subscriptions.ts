import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/action";
import {
  accessEndsAt,
  canTransitionPayment,
  computeActivationPeriod,
  hasPremiumAccess,
  renewalState,
} from "@/lib/domain/subscription";
import { formatDate } from "@/lib/time";
import { notify } from "./notify";
import { audit } from "./audit";
import { getSettings } from "./settings";
import type { Db } from "./db";

/** Droits d'accès d'un utilisateur à l'instant `now` (calculés, jamais lus d'un cache). */
export async function getStudentAccess(userId: string, now = new Date(), db: Db = prisma) {
  const subs = await db.subscription.findMany({
    where: { userId, status: { in: ["ACTIVE", "PENDING_PAYMENT", "EXPIRED"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return {
    hasPremium: hasPremiumAccess(subs, now),
    endsAt: accessEndsAt(subs, now),
    renewal: renewalState(subs, now),
    pending: subs.find((s) => s.status === "PENDING_PAYMENT") ?? null,
  };
}

export async function hasPremium(userId: string, now = new Date()) {
  return (await getStudentAccess(userId, now)).hasPremium;
}

/** L'élève choisit une offre et déclare son paiement (MVP : vérification manuelle). */
export async function requestSubscription(input: {
  userId: string;
  planId: string;
  method: PaymentMethod;
  reference: string;
  payerNote?: string;
}) {
  if (input.method === "ONLINE_GATEWAY") throw new AppError("forbidden");
  const settings = await getSettings();
  if (!settings.enabledPaymentMethods.includes(input.method)) throw new AppError("forbidden");

  return prisma.$transaction(async (tx) => {
    const plan = await tx.subscriptionPlan.findUnique({ where: { id: input.planId } });
    if (!plan || !plan.isActive) throw new AppError("planInactive");
    const pending = await tx.subscription.count({ where: { userId: input.userId, status: "PENDING_PAYMENT" } });
    if (pending > 0) throw new AppError("pendingExists");

    const sub = await tx.subscription.create({
      data: {
        userId: input.userId,
        planId: plan.id,
        status: "PENDING_PAYMENT",
        priceMillimes: plan.priceMillimes,
        currency: plan.currency,
      },
    });
    const payment = await tx.payment.create({
      data: {
        userId: input.userId,
        purpose: "SUBSCRIPTION",
        subscriptionId: sub.id,
        amountMillimes: plan.priceMillimes,
        currency: plan.currency,
        method: input.method,
        status: "PENDING",
        reference: input.reference,
        payerNote: input.payerNote,
        provider: "manual",
      },
    });
    return { subscription: sub, payment };
  });
}

/** L'élève retire sa propre demande tant qu'elle n'a pas été traitée. */
export async function cancelPendingRequest(userId: string, subscriptionId: string) {
  await prisma.$transaction(async (tx) => {
    const res = await tx.subscription.updateMany({
      where: { id: subscriptionId, userId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (res.count === 0) throw new AppError("notFound");
    await tx.payment.updateMany({
      where: { subscriptionId, status: "PENDING" },
      data: { status: "REJECTED", rejectionReason: "Demande annulée par l'élève" },
    });
  });
}

/**
 * Confirmation d'un paiement par un administrateur — seule voie d'activation au MVP.
 * Le passage PENDING → CONFIRMED est conditionnel (updateMany) : deux validations
 * simultanées ne peuvent pas activer deux fois.
 */
export async function confirmPayment(params: { paymentId: string; adminId: string; now?: Date }) {
  const now = params.now ?? new Date();
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: params.paymentId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!payment) throw new AppError("notFound");
    if (!canTransitionPayment(payment.status, "CONFIRMED")) throw new AppError("paymentState");

    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "CONFIRMED", verifiedById: params.adminId, verifiedAt: now },
    });
    if (claimed.count === 0) throw new AppError("paymentState");

    let endsAt: Date | null = null;
    if (payment.purpose === "SUBSCRIPTION" && payment.subscription) {
      const sub = payment.subscription;
      if (sub.status !== "PENDING_PAYMENT") throw new AppError("paymentState");
      const others = await tx.subscription.findMany({
        where: { userId: payment.userId, status: "ACTIVE", id: { not: sub.id } },
        select: { status: true, startsAt: true, endsAt: true },
      });
      const period = computeActivationPeriod({
        now,
        durationDays: sub.plan.durationDays,
        currentAccessEndsAt: accessEndsAt(others, now),
      });
      endsAt = period.endsAt;
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: "ACTIVE", startsAt: period.startsAt, endsAt: period.endsAt, activatedAt: now },
      });
    }
    await audit(params.adminId, "payment.confirm", "Payment", payment.id, { amount: payment.amountMillimes }, tx);
    return { payment, endsAt };
  });

  if (result.endsAt) {
    const endsAt = result.endsAt;
    await notify(
      result.payment.userId,
      "subscriptionActivated",
      (l) => ({ date: formatDate(endsAt, l, { dateStyle: "long" }) }),
      "/student/subscription",
    );
  }
  return result;
}

export async function rejectPayment(params: { paymentId: string; adminId: string; reason?: string }) {
  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: params.paymentId } });
    if (!p) throw new AppError("notFound");
    if (!canTransitionPayment(p.status, "REJECTED")) throw new AppError("paymentState");
    const claimed = await tx.payment.updateMany({
      where: { id: p.id, status: "PENDING" },
      data: { status: "REJECTED", verifiedById: params.adminId, verifiedAt: new Date(), rejectionReason: params.reason },
    });
    if (claimed.count === 0) throw new AppError("paymentState");
    if (p.subscriptionId) {
      await tx.subscription.updateMany({
        where: { id: p.subscriptionId, status: "PENDING_PAYMENT" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
    }
    await audit(params.adminId, "payment.reject", "Payment", p.id, { reason: params.reason ?? null }, tx);
    return p;
  });
  await notify(payment.userId, "paymentRejected", { reason: params.reason ?? "" }, "/student/subscription");
}

/** Remboursement : le paiement passe à REFUNDED et l'accès associé est coupé immédiatement. */
export async function refundPayment(params: { paymentId: string; adminId: string; reason?: string }) {
  const now = new Date();
  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: params.paymentId } });
    if (!p) throw new AppError("notFound");
    if (!canTransitionPayment(p.status, "REFUNDED")) throw new AppError("paymentState");
    const claimed = await tx.payment.updateMany({
      where: { id: p.id, status: "CONFIRMED" },
      data: { status: "REFUNDED", refundedAt: now, refundReason: params.reason },
    });
    if (claimed.count === 0) throw new AppError("paymentState");
    if (p.subscriptionId) {
      await tx.subscription.updateMany({
        where: { id: p.subscriptionId, status: { in: ["ACTIVE", "PENDING_PAYMENT"] } },
        data: { status: "CANCELLED", cancelledAt: now },
      });
    }
    await audit(params.adminId, "payment.refund", "Payment", p.id, { reason: params.reason ?? null }, tx);
    return p;
  });
  await notify(payment.userId, "paymentRefunded", { reason: params.reason ?? "" }, "/student/subscription");
}

export async function cancelSubscription(params: { subscriptionId: string; adminId: string }) {
  const res = await prisma.subscription.updateMany({
    where: { id: params.subscriptionId, status: { in: ["ACTIVE", "PENDING_PAYMENT"] } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  if (res.count === 0) throw new AppError("invalidTransition");
  await audit(params.adminId, "subscription.cancel", "Subscription", params.subscriptionId);
}

/** Prolongation manuelle (geste commercial, incident…), journalisée. */
export async function extendSubscription(params: { subscriptionId: string; adminId: string; days: number }) {
  if (!Number.isInteger(params.days) || params.days < 1 || params.days > 366) throw new AppError("invalidNumber");
  const sub = await prisma.subscription.findUnique({ where: { id: params.subscriptionId } });
  if (!sub || sub.status !== "ACTIVE" || !sub.endsAt) throw new AppError("invalidTransition");
  const now = new Date();
  const base = sub.endsAt > now ? sub.endsAt : now;
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { endsAt: new Date(base.getTime() + params.days * 86_400_000), expiryReminderAt: null },
  });
  await audit(params.adminId, "subscription.extend", "Subscription", sub.id, { days: params.days });
}

/**
 * Passe en EXPIRED les abonnements arrivés à échéance et prévient les élèves.
 * L'accès est déjà coupé par le calcul du statut effectif ; cette tâche sert à
 * l'affichage, aux statistiques et aux notifications.
 */
export async function expireSubscriptions(now = new Date()) {
  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", endsAt: { lte: now } },
    select: { id: true, userId: true },
  });
  if (due.length === 0) return 0;
  await prisma.subscription.updateMany({
    where: { id: { in: due.map((d) => d.id) }, status: "ACTIVE" },
    data: { status: "EXPIRED" },
  });
  for (const userId of new Set(due.map((d) => d.userId))) {
    const access = await getStudentAccess(userId, now);
    if (!access.hasPremium) await notify(userId, "subscriptionExpired", {}, "/student/subscription");
  }
  return due.length;
}

/** Rappel unique quelques jours avant l'échéance, sauf si un renouvellement est déjà prévu. */
export async function sendExpiryReminders(now = new Date(), daysBefore = 3) {
  const limit = new Date(now.getTime() + daysBefore * 86_400_000);
  const subs = await prisma.subscription.findMany({
    where: { status: "ACTIVE", expiryReminderAt: null, endsAt: { gt: now, lte: limit } },
  });
  let sent = 0;
  for (const sub of subs) {
    const later = await prisma.subscription.count({
      where: {
        userId: sub.userId,
        id: { not: sub.id },
        OR: [{ status: "PENDING_PAYMENT" }, { status: "ACTIVE", endsAt: { gt: sub.endsAt! } }],
      },
    });
    await prisma.subscription.update({ where: { id: sub.id }, data: { expiryReminderAt: now } });
    if (later > 0) continue;
    const endsAt = sub.endsAt!;
    await notify(
      sub.userId,
      "subscriptionExpiring",
      (l) => ({ date: formatDate(endsAt, l, { dateStyle: "long" }) }),
      "/student/subscription",
    );
    sent++;
  }
  return sent;
}
