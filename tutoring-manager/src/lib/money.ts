// Montants : on calcule en millimes entiers (1 DT = 1000 millimes) pour éviter
// toute erreur d'arrondi en virgule flottante, puis on reconvertit pour l'affichage.

export type Millimes = number;

/** Convertit un Decimal Prisma, une chaîne ou un nombre (en dinars) en millimes entiers. */
export function toMil(v: unknown): Millimes {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000);
}

/** Millimes → dinars (nombre), pour les API et les graphiques. */
export function fromMil(m: Millimes): number {
  return Math.round(m) / 1000;
}

/** Millimes → chaîne décimale exacte pour Prisma (Decimal). */
export function milToDecimalString(m: Millimes): string {
  const sign = m < 0 ? "-" : "";
  const a = Math.abs(Math.round(m));
  return `${sign}${Math.floor(a / 1000)}.${String(a % 1000).padStart(3, "0")}`;
}

export const CURRENCY = "DT";

/** 45 DT · 12,500 DT · -3 DT */
export function formatDT(dinars: number | null | undefined, opts: { sign?: boolean } = {}) {
  const v = dinars ?? 0;
  const n = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(Math.abs(v));
  const sign = v < 0 ? "−" : opts.sign && v > 0 ? "+" : "";
  return `${sign}${n} ${CURRENCY}`;
}
