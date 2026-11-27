import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/action";
import { confirmPayment, expireSubscriptions, getStudentAccess, refundPayment, rejectPayment, requestSubscription } from "@/server/subscriptions";
import { hasDb, makeCatalog, makeUser, resetDb } from "./helpers";

const DAY = 86_400_000;

describe.skipIf(!hasDb)("abonnements (intégration)", () => {
  let ctx: Awaited<ReturnType<typeof makeCatalog>>;
  beforeEach(async () => {
    await resetDb();
    ctx = await makeCatalog();
  });

  async function request(userId: string) {
    return requestSubscription({ userId, planId: ctx.plan.id, method: "BANK_TRANSFER", reference: "REF-1" });
  }

  it("une demande crée un abonnement en attente SANS accès, au prix configuré", async () => {
    const student = await makeUser();
    const { subscription, payment } = await request(student.id);
    expect(subscription.status).toBe("PENDING_PAYMENT");
    expect(payment).toMatchObject({ status: "PENDING", amountMillimes: 10_000, provider: "manual" });
    expect((await getStudentAccess(student.id)).hasPremium).toBe(false);
  });

  it("le prix est figé : modifier l'offre ne change pas une demande existante", async () => {
    const student = await makeUser();
    const { subscription } = await request(student.id);
    await prisma.subscriptionPlan.update({ where: { id: ctx.plan.id }, data: { priceMillimes: 15_000 } });
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).priceMillimes).toBe(10_000);
  });

  it("une seule demande en attente à la fois ; offre inactive refusée ; paiement en ligne refusé", async () => {
    const student = await makeUser();
    await request(student.id);
    await expect(request(student.id)).rejects.toMatchObject({ code: "pendingExists" });
    const other = await makeUser();
    await prisma.subscriptionPlan.update({ where: { id: ctx.plan.id }, data: { isActive: false } });
    await expect(request(other.id)).rejects.toMatchObject({ code: "planInactive" });
    await expect(requestSubscription({ userId: other.id, planId: ctx.plan.id, method: "ONLINE_GATEWAY", reference: "x" })).rejects.toBeInstanceOf(AppError);
  });

  it("seule la confirmation par un admin active l'accès, pour la durée de l'offre", async () => {
    const [student, admin] = [await makeUser(), await makeUser("ADMIN")];
    const { payment } = await request(student.id);
    const now = new Date();
    await confirmPayment({ paymentId: payment.id, adminId: admin.id, now });
    const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: student.id } });
    expect(sub.status).toBe("ACTIVE");
    expect(sub.endsAt!.getTime() - sub.startsAt!.getTime()).toBe(30 * DAY);
    expect((await getStudentAccess(student.id)).hasPremium).toBe(true);
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(p).toMatchObject({ status: "CONFIRMED", verifiedById: admin.id });
    expect(await prisma.notification.count({ where: { userId: student.id, type: "SUBSCRIPTION_ACTIVATED" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "payment.confirm" } })).toBe(1);
  });

  it("deux confirmations simultanées n'activent qu'une fois", async () => {
    const [student, admin] = [await makeUser(), await makeUser("ADMIN")];
    const { payment } = await request(student.id);
    const results = await Promise.allSettled([confirmPayment({ paymentId: payment.id, adminId: admin.id }), confirmPayment({ paymentId: payment.id, adminId: admin.id })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.notification.count({ where: { userId: student.id } })).toBe(1);
  });

  it("le renouvellement anticipé prolonge sans perdre de jours", async () => {
    const [student, admin] = [await makeUser(), await makeUser("ADMIN")];
    const t0 = new Date();
    const first = await request(student.id);
    await confirmPayment({ paymentId: first.payment.id, adminId: admin.id, now: t0 });
    const second = await request(student.id);
    await confirmPayment({ paymentId: second.payment.id, adminId: admin.id, now: new Date(t0.getTime() + 10 * DAY) });
    const access = await getStudentAccess(student.id, new Date(t0.getTime() + 10 * DAY));
    expect(access.endsAt!.getTime()).toBe(t0.getTime() + 60 * DAY);
  });

  it("à l'expiration, l'accès est coupé immédiatement, puis le statut est mis à jour par la tâche", async () => {
    const [student, admin] = [await makeUser(), await makeUser("ADMIN")];
    const { payment } = await request(student.id);
    const t0 = new Date();
    await confirmPayment({ paymentId: payment.id, adminId: admin.id, now: t0 });
    const after = new Date(t0.getTime() + 31 * DAY);
    // Avant même le passage de la tâche planifiée : plus d'accès.
    expect((await getStudentAccess(student.id, after)).hasPremium).toBe(false);
    expect(await expireSubscriptions(after)).toBe(1);
    expect((await prisma.subscription.findFirstOrThrow({ where: { userId: student.id } })).status).toBe("EXPIRED");
    expect(await prisma.notification.count({ where: { userId: student.id, type: "SUBSCRIPTION_EXPIRED" } })).toBe(1);
  });

  it("un refus annule la demande ; un remboursement coupe l'accès", async () => {
    const [s1, s2, admin] = [await makeUser(), await makeUser(), await makeUser("ADMIN")];
    const r1 = await request(s1.id);
    await rejectPayment({ paymentId: r1.payment.id, adminId: admin.id, reason: "Référence introuvable" });
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: r1.subscription.id } })).status).toBe("CANCELLED");
    await expect(confirmPayment({ paymentId: r1.payment.id, adminId: admin.id })).rejects.toMatchObject({ code: "paymentState" });

    const r2 = await request(s2.id);
    await confirmPayment({ paymentId: r2.payment.id, adminId: admin.id });
    expect((await getStudentAccess(s2.id)).hasPremium).toBe(true);
    await refundPayment({ paymentId: r2.payment.id, adminId: admin.id, reason: "Doublon" });
    expect((await getStudentAccess(s2.id)).hasPremium).toBe(false);
    await expect(refundPayment({ paymentId: r2.payment.id, adminId: admin.id })).rejects.toMatchObject({ code: "paymentState" });
  });
});
