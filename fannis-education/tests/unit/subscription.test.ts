import { describe, expect, it } from "vitest";
import {
  accessEndsAt,
  canAccessContent,
  canTransitionPayment,
  computeActivationPeriod,
  effectiveStatus,
  hasPremiumAccess,
  renewalState,
  type SubscriptionLike,
} from "@/lib/domain/subscription";

const now = new Date("2026-03-15T10:00:00Z");
const day = 86_400_000;
const sub = (status: SubscriptionLike["status"], startOffsetDays: number | null, endOffsetDays: number | null): SubscriptionLike => ({
  status,
  startsAt: startOffsetDays === null ? null : new Date(now.getTime() + startOffsetDays * day),
  endsAt: endOffsetDays === null ? null : new Date(now.getTime() + endOffsetDays * day),
});

describe("statut effectif", () => {
  it("un abonnement actif dans sa période reste actif", () => {
    expect(effectiveStatus(sub("ACTIVE", -5, 25), now)).toBe("ACTIVE");
  });
  it("un abonnement ACTIVE dont la date de fin est passée est EXPIRÉ (sans attendre le cron)", () => {
    expect(effectiveStatus(sub("ACTIVE", -40, -10), now)).toBe("EXPIRED");
  });
  it("la date de fin exacte est exclusive", () => {
    expect(effectiveStatus({ status: "ACTIVE", startsAt: new Date(now.getTime() - day), endsAt: now }, now)).toBe("EXPIRED");
  });
  it("données incohérentes (ACTIVE sans dates) → aucun accès", () => {
    expect(effectiveStatus(sub("ACTIVE", null, null), now)).toBe("EXPIRED");
  });
  it("les autres statuts sont conservés", () => {
    expect(effectiveStatus(sub("PENDING_PAYMENT", null, null), now)).toBe("PENDING_PAYMENT");
    expect(effectiveStatus(sub("CANCELLED", -5, 25), now)).toBe("CANCELLED");
  });
});

describe("accès premium", () => {
  it("accordé avec un abonnement actif", () => {
    expect(hasPremiumAccess([sub("ACTIVE", -1, 29)], now)).toBe(true);
  });
  it("refusé quand l'abonnement a expiré", () => {
    expect(hasPremiumAccess([sub("ACTIVE", -31, -1)], now)).toBe(false);
    expect(hasPremiumAccess([sub("EXPIRED", -31, -1)], now)).toBe(false);
  });
  it("refusé pour un paiement en attente ou un abonnement annulé/remboursé", () => {
    expect(hasPremiumAccess([sub("PENDING_PAYMENT", null, null)], now)).toBe(false);
    expect(hasPremiumAccess([sub("CANCELLED", -1, 29)], now)).toBe(false);
  });
  it("refusé pour une période qui n'a pas encore commencé", () => {
    expect(hasPremiumAccess([sub("ACTIVE", 2, 32)], now)).toBe(false);
  });
  it("accessEndsAt renvoie la fin la plus lointaine", () => {
    const end = accessEndsAt([sub("ACTIVE", -10, 20), sub("ACTIVE", 20, 50), sub("EXPIRED", -60, -30)], now);
    expect(end?.getTime()).toBe(now.getTime() + 50 * day);
  });
});

describe("droit d'accès au contenu", () => {
  it("contenu gratuit : tout utilisateur connecté, jamais un visiteur", () => {
    expect(canAccessContent({ accessLevel: "FREE", role: "STUDENT", hasPremium: false })).toBe(true);
    expect(canAccessContent({ accessLevel: "FREE", role: null, hasPremium: false })).toBe(false);
  });
  it("contenu premium : élève abonné uniquement", () => {
    expect(canAccessContent({ accessLevel: "PREMIUM", role: "STUDENT", hasPremium: true })).toBe(true);
    expect(canAccessContent({ accessLevel: "PREMIUM", role: "STUDENT", hasPremium: false })).toBe(false);
  });
  it("un enseignant n'accède qu'à ses propres contenus premium", () => {
    expect(canAccessContent({ accessLevel: "PREMIUM", role: "TEACHER", hasPremium: false })).toBe(false);
    expect(canAccessContent({ accessLevel: "PREMIUM", role: "TEACHER", hasPremium: false, isAuthor: true })).toBe(true);
  });
  it("l'administrateur accède à tout", () => {
    expect(canAccessContent({ accessLevel: "PREMIUM", role: "ADMIN", hasPremium: false })).toBe(true);
  });
});

describe("période d'activation et renouvellement", () => {
  it("sans accès en cours, la période commence maintenant", () => {
    const p = computeActivationPeriod({ now, durationDays: 30, currentAccessEndsAt: null });
    expect(p.startsAt).toEqual(now);
    expect(p.endsAt.getTime() - now.getTime()).toBe(30 * day);
  });
  it("un renouvellement anticipé s'ajoute à la fin de l'accès actuel (aucun jour perdu)", () => {
    const current = new Date(now.getTime() + 10 * day);
    const p = computeActivationPeriod({ now, durationDays: 30, currentAccessEndsAt: current });
    expect(p.startsAt).toEqual(current);
    expect(p.endsAt.getTime()).toBe(now.getTime() + 40 * day);
  });
  it("un accès déjà terminé est ignoré", () => {
    const p = computeActivationPeriod({ now, durationDays: 30, currentAccessEndsAt: new Date(now.getTime() - day) });
    expect(p.startsAt).toEqual(now);
  });
  it("refuse une durée invalide", () => {
    expect(() => computeActivationPeriod({ now, durationDays: 0, currentAccessEndsAt: null })).toThrow();
  });
  it("renewalState signale l'échéance proche, l'expiration et la demande en attente", () => {
    expect(renewalState([], now).state).toBe("NONE");
    expect(renewalState([sub("ACTIVE", -25, 3)], now)).toMatchObject({ state: "EXPIRING_SOON", daysLeft: 3 });
    expect(renewalState([sub("ACTIVE", -5, 25)], now).state).toBe("ACTIVE");
    expect(renewalState([sub("ACTIVE", -40, -10)], now).state).toBe("EXPIRED");
    expect(renewalState([sub("PENDING_PAYMENT", null, null)], now).state).toBe("PENDING");
  });
});

describe("transitions de paiement", () => {
  it("seul un paiement en attente peut être confirmé ou refusé", () => {
    expect(canTransitionPayment("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransitionPayment("PENDING", "REJECTED")).toBe(true);
    expect(canTransitionPayment("CONFIRMED", "CONFIRMED")).toBe(false);
    expect(canTransitionPayment("REJECTED", "CONFIRMED")).toBe(false);
  });
  it("seul un paiement confirmé peut être remboursé", () => {
    expect(canTransitionPayment("CONFIRMED", "REFUNDED")).toBe(true);
    expect(canTransitionPayment("PENDING", "REFUNDED")).toBe(false);
    expect(canTransitionPayment("REFUNDED", "REFUNDED")).toBe(false);
  });
});
