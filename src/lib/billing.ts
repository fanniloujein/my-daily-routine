// Calculs de facturation des cours particuliers (fonctions pures, testées).

export type BillingMode = "SESSION" | "HOUR" | "MONTH" | "FREE";

export const BILLING_LABELS: Record<BillingMode, string> = {
  SESSION: "Par séance",
  HOUR: "Par heure",
  MONTH: "Forfait mensuel",
  FREE: "Gratuit",
};

export const PAYMENT_METHODS: Record<string, string> = {
  CASH: "Espèces",
  TRANSFER: "Virement",
  CARD: "Carte",
  CHECK: "Chèque",
  OTHER: "Autre",
};

export const INCOME_SOURCES: Record<string, string> = {
  TUTORING: "Cours particuliers",
  FREELANCE: "Freelance",
  OTHER: "Autre",
};

export const CURRENCIES: Record<string, string> = {
  EUR: "Euro (€)",
  MAD: "Dirham marocain (MAD)",
  DZD: "Dinar algérien (DZD)",
  TND: "Dinar tunisien (TND)",
  CHF: "Franc suisse (CHF)",
  CAD: "Dollar canadien (CAD)",
  USD: "Dollar américain ($)",
  GBP: "Livre sterling (£)",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Montant dû pour une séance selon le mode de facturation de l'élève (null : rien à facturer par séance). */
export function lessonPrice(mode: string, rate: number | null | undefined, durationMin: number): number | null {
  if (rate == null || rate <= 0) return null;
  if (mode === "SESSION") return round2(rate);
  if (mode === "HOUR") return round2((rate * durationMin) / 60);
  return null;
}

export function formatMoney(amount: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function monthOf(date: string) {
  return date.slice(0, 7);
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  const s = new Date(y, m - 1, 15).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function addMonthsStr(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 15);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type L = { date: string; status: string; price: number | null; incomeId: string | null };

/**
 * Situation d'un élève (ou groupe) pour un mois donné.
 * - Par séance / par heure : dû = séances réalisées du mois ; payé = celles réglées.
 * - Forfait mensuel : dû = le forfait si au moins une séance (non annulée) a lieu ce mois-là ; payé = paiements rattachés au mois.
 */
export function monthSituation(
  s: { billingMode: string; rate: number | null },
  lessons: L[],
  monthlyPaid: number,
  month: string,
) {
  const inMonth = lessons.filter((l) => monthOf(l.date) === month && l.status !== "CANCELLED");
  const done = inMonth.filter((l) => l.status === "DONE");
  if (s.billingMode === "MONTH") {
    const due = inMonth.length > 0 && s.rate ? s.rate : 0;
    return { sessions: done.length, planned: inMonth.length, due, paid: round2(monthlyPaid), remaining: Math.max(0, round2(due - monthlyPaid)) };
  }
  const due = round2(done.reduce((a, l) => a + (l.price ?? 0), 0));
  const paid = round2(done.filter((l) => l.incomeId).reduce((a, l) => a + (l.price ?? 0), 0));
  return { sessions: done.length, planned: inMonth.length, due, paid, remaining: round2(due - paid) };
}

/** Séances réalisées, payantes et non réglées (toutes périodes). */
export function unpaidLessons<T extends L>(lessons: T[]): T[] {
  return lessons.filter((l) => l.status === "DONE" && (l.price ?? 0) > 0 && !l.incomeId);
}
