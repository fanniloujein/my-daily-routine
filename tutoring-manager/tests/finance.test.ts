import { describe, expect, it } from "vitest";
import { computeLedger, creditAlert, isBillable, sessionsCovered, type FInvoice, type FPayment } from "@/lib/finance";
import { formatDT, fromMil, milToDecimalString, toMil } from "@/lib/money";

let t = 0;
const inv = (id: string, amount: number, date = "2026-11-01", extra: Partial<FInvoice> = {}): FInvoice => ({ id, amount: toMil(amount), date, createdAt: ++t, ...extra });
const pay = (id: string, amount: number, kind: FPayment["kind"] = "PAYMENT", date = "2026-11-01", extra: Partial<FPayment> = {}): FPayment => ({ id, amount: toMil(amount), kind, date, createdAt: ++t, ...extra });

describe("montants en millimes", () => {
  it("convertit sans erreur d'arrondi", () => {
    expect(toMil("12.345")).toBe(12345);
    expect(toMil(0.1) + toMil(0.2)).toBe(toMil(0.3));
    expect(fromMil(12345)).toBe(12.345);
    expect(milToDecimalString(-1500)).toBe("-1.500");
    expect(milToDecimalString(45000)).toBe("45.000");
    expect(formatDT(12.5)).toBe("12,5 DT");
  });
});

describe("avance consommée par les séances (exemple du cahier des charges)", () => {
  it("100 DT d'avance puis 3 séances à 25 DT", () => {
    const p = [pay("a1", 100, "ADVANCE")];
    const i = [inv("s1", 25), inv("s2", 25), inv("s3", 25)];
    const l = computeLedger(i, p);
    expect(l.totals.advancesReceived).toBe(100000);
    expect(l.totals.credit).toBe(25000); // 100 - 75
    expect(l.totals.due).toBe(0);
    expect(l.totals.creditUsed).toBe(75000);
    // Revenu = seulement ce qui a été consommé
    expect(l.totals.cashApplied).toBe(75000);
    // L'avance n'est pas comptée comme paiement
    expect(l.totals.paymentsReceived).toBe(0);
    expect([...l.invoices.values()].every((s) => s.status === "PAID")).toBe(true);
  });

  it("crédit insuffisant : la 4e séance reste partiellement due", () => {
    const l = computeLedger([inv("s1", 30), inv("s2", 30), inv("s3", 30), inv("s4", 30)], [pay("a1", 100, "ADVANCE")]);
    // l'avance a été saisie après les factures : elle règle les dettes existantes
    expect(l.totals.due).toBe(20000);
    expect(l.totals.credit).toBe(0);
  });

  it("jamais de crédit et de dette en même temps", () => {
    const l = computeLedger([inv("s1", 40)], [pay("a", 10, "ADVANCE")]);
    expect(l.totals.credit).toBe(0);
    expect(l.totals.due).toBe(30000);
  });
});

describe("dettes et paiements partiels", () => {
  it("séances non payées puis plusieurs paiements partiels", () => {
    const i = [inv("s1", 30, "2026-10-01"), inv("s2", 30, "2026-10-08"), inv("s3", 30, "2026-10-15")];
    const p = [pay("p1", 20, "PAYMENT", "2026-10-20"), pay("p2", 50, "PAYMENT", "2026-10-25")];
    const l = computeLedger(i, p);
    expect(l.totals.billed).toBe(90000);
    expect(l.totals.paymentsReceived).toBe(70000);
    expect(l.totals.due).toBe(20000);
    expect(l.invoices.get("s1")!.status).toBe("PAID");
    expect(l.invoices.get("s2")!.status).toBe("PAID");
    expect(l.invoices.get("s3")).toEqual({ paid: 10000, remaining: 20000, status: "PARTIAL" });
  });

  it("le trop-perçu devient du crédit, utilisé à la séance suivante", () => {
    const l = computeLedger([inv("s1", 30), inv("s2", 30, "2026-11-08")].map((x, k) => ({ ...x, createdAt: k === 0 ? 1 : 3 })), [{ ...pay("p", 50), createdAt: 2 }]);
    expect(l.totals.due).toBe(10000);
    expect(l.totals.credit).toBe(0);
    expect(l.allocations.filter((a) => a.invoiceId === "s2")[0].amount).toBe(20000);
  });

  it("paiement groupé : règle d'abord les séances choisies", () => {
    const i = [inv("old", 30, "2026-09-01"), inv("a", 30, "2026-10-01"), inv("b", 30, "2026-10-08")];
    const l = computeLedger(i, [pay("p", 60, "PAYMENT", "2026-11-01", { targets: ["a", "b"] })]);
    expect(l.invoices.get("a")!.status).toBe("PAID");
    expect(l.invoices.get("b")!.status).toBe("PAID");
    expect(l.invoices.get("old")!.status).toBe("UNPAID");
  });
});

describe("annulations et corrections (traçabilité)", () => {
  it("une facture annulée libère le crédit consommé", () => {
    const p = [pay("a", 50, "ADVANCE")];
    const i = [inv("s1", 25), inv("s2", 25, "2026-11-02", { voided: true })];
    const l = computeLedger(i, p);
    expect(l.totals.credit).toBe(25000);
    expect(l.totals.billed).toBe(25000);
  });

  it("un paiement annulé fait réapparaître la dette", () => {
    const l = computeLedger([inv("s1", 25)], [pay("p", 25, "PAYMENT", "2026-11-01", { voided: true })]);
    expect(l.totals.due).toBe(25000);
    expect(l.totals.paymentsReceived).toBe(0);
  });

  it("remboursement : diminue le crédit, pas les revenus", () => {
    const l = computeLedger([inv("s1", 20)], [pay("a", 100, "ADVANCE")], [{ id: "r", amount: 30000, date: "2026-11-05", createdAt: ++t }]);
    expect(l.totals.credit).toBe(50000);
    expect(l.totals.refunded).toBe(30000);
    expect(l.totals.cashApplied).toBe(20000);
  });

  it("remboursement au-delà du crédit (après annulation) : redevient dû", () => {
    const l = computeLedger([], [pay("a", 50, "ADVANCE", "2026-11-01", { voided: true })], [{ id: "r", amount: 20000, date: "2026-11-05", createdAt: ++t }]);
    expect(l.totals.credit).toBe(0);
    expect(l.totals.due).toBe(20000);
  });

  it("remise : réduit la dette mais n'est pas un revenu encaissé", () => {
    const l = computeLedger([inv("s1", 30)], [pay("d", 10, "DISCOUNT"), pay("p", 20)]);
    expect(l.totals.due).toBe(0);
    expect(l.totals.cashApplied).toBe(20000);
    expect(l.totals.discounts).toBe(10000);
  });
});

describe("identité comptable", () => {
  it("argent reçu = revenus encaissés + crédit + remboursements (sans remise)", () => {
    const i = Array.from({ length: 6 }, (_, k) => inv(`s${k}`, 15 + (k % 4) * 5, `2026-10-${String(k + 1).padStart(2, "0")}`));
    const p = [pay("a", 120, "ADVANCE"), pay("b", 37.5), pay("c", 80, "ADVANCE")];
    const l = computeLedger(i, p, [{ id: "r", amount: 5000, date: "2026-11-01", createdAt: ++t }]);
    expect(l.totals.cashReceived).toBe(l.totals.cashApplied + l.totals.credit + l.totals.refunded);
    expect(l.totals.billed - l.totals.paidOnInvoices).toBe(l.totals.due);
  });
});

describe("règles de facturation", () => {
  it("statuts facturables", () => {
    expect(isBillable("DONE", "PER_SESSION")).toBe(true);
    expect(isBillable("DONE", "ADVANCE")).toBe(true);
    expect(isBillable("DONE", "MONTHLY")).toBe(false);
    expect(isBillable("CANCELLED", "PER_SESSION")).toBe(false);
    expect(isBillable("POSTPONED", "PER_SESSION")).toBe(false);
    expect(isBillable("TEACHER_ABSENT", "PER_SESSION")).toBe(false);
    expect(isBillable("STUDENT_ABSENT", "PER_SESSION")).toBe(false);
    expect(isBillable("STUDENT_ABSENT", "PER_SESSION", { lateAbsenceBillable: true })).toBe(true);
    expect(isBillable("DONE", "PER_SESSION", { individuallyAbsent: true })).toBe(false);
  });
  it("alertes de crédit", () => {
    expect(creditAlert(10000, 0, 25000)).toBe("INSUFFICIENT");
    expect(creditAlert(30000, 0, 25000)).toBe("LOW");
    expect(creditAlert(80000, 0, 25000)).toBe(null);
    expect(sessionsCovered(80000, 25000)).toBe(3);
  });
});
