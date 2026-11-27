/** Les montants sont stockés en millimes (1 TND = 1000 millimes). */

export function formatMoney(millimes: number, locale: "fr" | "ar" = "fr", currency = "TND"): string {
  const value = millimes / 1000;
  const digits = Number.isInteger(value) ? 0 : 3;
  const n = new Intl.NumberFormat(locale === "ar" ? "ar-TN" : "fr-TN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: 3,
  }).format(value);
  if (currency !== "TND") return `${n} ${currency}`;
  return locale === "ar" ? `${n} د.ت` : `${n} DT`;
}

/** "10", "10.5", "10,500" → millimes. Renvoie null si invalide. */
export function parseTndToMillimes(input: string | number): number | null {
  const s = String(input).trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,3})?$/.test(s)) return null;
  const [int, dec = ""] = s.split(".");
  return Number(int) * 1000 + Number(dec.padEnd(3, "0"));
}

export function millimesToTndString(millimes: number): string {
  const v = millimes / 1000;
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, "");
}
