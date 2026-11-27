/**
 * Règles d'abonnement — logique pure (sans base de données), testée unitairement.
 */
export type SubscriptionStatus = "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "CANCELLED";
export type AccessLevel = "FREE" | "PREMIUM";
export type Role = "STUDENT" | "TEACHER" | "ADMIN";

export interface SubscriptionLike {
  status: SubscriptionStatus;
  startsAt: Date | null;
  endsAt: Date | null;
}

/**
 * Statut effectif à un instant donné. Un abonnement « ACTIVE » dont la date de fin est
 * passée est EXPIRÉ, même si la tâche planifiée ne l'a pas encore mis à jour :
 * l'accès ne dépend jamais d'un cron.
 */
export function effectiveStatus(sub: SubscriptionLike, now: Date): SubscriptionStatus {
  if (sub.status !== "ACTIVE") return sub.status;
  if (!sub.endsAt || !sub.startsAt) return "EXPIRED"; // données incohérentes → aucun accès
  if (sub.endsAt.getTime() <= now.getTime()) return "EXPIRED";
  return "ACTIVE";
}

/** Vrai si l'abonnement donne accès au contenu premium à l'instant `now`. */
export function isSubscriptionLive(sub: SubscriptionLike, now: Date): boolean {
  return (
    effectiveStatus(sub, now) === "ACTIVE" &&
    !!sub.startsAt &&
    sub.startsAt.getTime() <= now.getTime()
  );
}

export function hasPremiumAccess(subs: SubscriptionLike[], now: Date): boolean {
  return subs.some((s) => isSubscriptionLive(s, now));
}

/** Date de fin d'accès la plus lointaine parmi les abonnements actifs ou à venir. */
export function accessEndsAt(subs: SubscriptionLike[], now: Date): Date | null {
  let end: Date | null = null;
  for (const s of subs) {
    if (effectiveStatus(s, now) !== "ACTIVE" || !s.endsAt) continue;
    if (!end || s.endsAt > end) end = s.endsAt;
  }
  return end;
}

export interface ContentAccessInput {
  accessLevel: AccessLevel;
  role: Role | null;
  hasPremium: boolean;
  isAuthor?: boolean;
}

/**
 * Peut-on afficher/télécharger ce contenu ?
 * - FREE : tout utilisateur connecté.
 * - PREMIUM : élève avec abonnement actif, administrateur, ou auteur du contenu.
 */
export function canAccessContent({ accessLevel, role, hasPremium, isAuthor }: ContentAccessInput): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  if (isAuthor) return true;
  if (accessLevel === "FREE") return true;
  return role === "STUDENT" && hasPremium;
}

/**
 * Période d'activation lors de la validation d'un paiement.
 * Si l'élève a déjà un accès qui court au-delà de `now`, la nouvelle période commence
 * à la fin de cet accès (renouvellement anticipé sans perte de jours).
 */
export function computeActivationPeriod(params: {
  now: Date;
  durationDays: number;
  currentAccessEndsAt: Date | null;
}): { startsAt: Date; endsAt: Date } {
  const { now, durationDays, currentAccessEndsAt } = params;
  if (!Number.isInteger(durationDays) || durationDays <= 0) throw new Error("durationDays must be a positive integer");
  const startsAt = currentAccessEndsAt && currentAccessEndsAt > now ? currentAccessEndsAt : now;
  return { startsAt, endsAt: new Date(startsAt.getTime() + durationDays * 86_400_000) };
}

export type RenewalState = "NONE" | "PENDING" | "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";

/** Résumé pour l'interface : faut-il proposer un renouvellement ? */
export function renewalState(
  subs: (SubscriptionLike & { createdAt?: Date })[],
  now: Date,
  soonDays = 5,
): { state: RenewalState; endsAt: Date | null; daysLeft: number | null } {
  const endsAt = accessEndsAt(subs, now);
  const hasPending = subs.some((s) => s.status === "PENDING_PAYMENT");
  if (endsAt) {
    const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000);
    if (hasPending) return { state: "PENDING", endsAt, daysLeft };
    return { state: daysLeft <= soonDays ? "EXPIRING_SOON" : "ACTIVE", endsAt, daysLeft };
  }
  if (hasPending) return { state: "PENDING", endsAt: null, daysLeft: null };
  const hadOne = subs.some((s) => ["ACTIVE", "EXPIRED"].includes(effectiveStatus(s, now)));
  return { state: hadOne ? "EXPIRED" : "NONE", endsAt: null, daysLeft: null };
}

export type PaymentStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "REFUNDED";

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["CONFIRMED", "REJECTED"],
  CONFIRMED: ["REFUNDED"],
  REJECTED: [],
  REFUNDED: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}
