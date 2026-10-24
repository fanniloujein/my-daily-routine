import { describe, expect, it } from "vitest";
import { review } from "@/lib/srs";
import { ambiguityWarnings, dosesForDay } from "@/lib/meds";
import { buildIcs, rruleFor } from "@/lib/ics";
import { suggestNow } from "@/lib/suggestions";

describe("répétition espacée", () => {
  it("allonge l'intervalle quand on réussit, revient à 1 jour en cas d'oubli", () => {
    let c = { ease: 2.5, interval: 0, reps: 0, lapses: 0 };
    const r1 = review(c, 2, "2026-10-12");
    expect(r1.dueDate).toBe("2026-10-13");
    c = r1;
    const r2 = review(c, 2, "2026-10-13");
    expect(r2.interval).toBe(6);
    const r3 = review(r2, 2, "2026-10-19");
    expect(r3.interval).toBe(15);
    const lapse = review(r3, 0, "2026-11-03");
    expect(lapse).toMatchObject({ interval: 1, reps: 0, lapses: 1 });
    expect(lapse.ease).toBeLessThan(r3.ease);
  });
});

describe("médicaments", () => {
  const m = { times: ["20:00", "08:00"], frequency: "DAILY", weekdays: [], everyNDays: 1, startDate: "2026-10-10", endDate: "2026-10-20", active: true };
  it("respecte strictement les dates et horaires saisis", () => {
    expect(dosesForDay(m, "2026-10-12")).toEqual(["08:00", "20:00"]);
    expect(dosesForDay(m, "2026-10-09")).toEqual([]);
    expect(dosesForDay(m, "2026-10-21")).toEqual([]);
    expect(dosesForDay({ ...m, frequency: "EVERY_N_DAYS", everyNDays: 2 }, "2026-10-11")).toEqual([]);
    expect(dosesForDay({ ...m, frequency: "WEEKDAYS", weekdays: [1] }, "2026-10-12")).toEqual(["08:00", "20:00"]);
    expect(dosesForDay({ ...m, active: false }, "2026-10-12")).toEqual([]);
  });
  it("signale les consignes ambiguës sans les interpréter", () => {
    expect(ambiguityWarnings({ instructions: "1 comprimé si besoin", times: ["08:00"] })).toHaveLength(1);
    expect(ambiguityWarnings({ instructions: "3 fois par jour", times: ["08:00", "20:00"] }).length).toBeGreaterThan(0);
    expect(ambiguityWarnings({ instructions: "Pendant le repas du matin", times: ["08:00"] })).toHaveLength(0);
  });
});

describe("iCalendar", () => {
  it("produit un fichier valide avec alarme et récurrence", () => {
    const ics = buildIcs([{ uid: "x", title: "Cours; maths", date: "2026-10-13", startTime: "17:00", durationMin: 60, alarmsMin: [30], rrule: rruleFor({ recurrence: "WEEKLY", interval: 1, weekdays: [2], until: null }) }]);
    expect(ics).toContain("DTSTART:20261013T170000");
    expect(ics).toContain("DTEND:20261013T180000");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=TU");
    expect(ics).toContain("SUMMARY:Cours\; maths");
  });
});

describe("Que puis-je faire maintenant ?", () => {
  it("propose du repos quand l'énergie est basse et respecte le temps disponible", () => {
    const s = suggestNow({ freeMinutes: 25, energy: 1, media: [{ id: "m", title: "Dark", type: "SERIES", durationMin: 55, status: "WATCHING" }], ideas: [] });
    expect(s.every((x) => x.durationMin <= 25)).toBe(true);
    expect(s[0].kind).toBe("RELAX");
  });
  it("propose un épisode s'il y a le temps", () => {
    const s = suggestNow({ freeMinutes: 60, energy: 3, media: [{ id: "m", title: "Dark", type: "SERIES", durationMin: 55, status: "WATCHING" }], ideas: [] });
    expect(s[0].title).toContain("Dark");
  });
});

import { lessonPrice, monthSituation, unpaidLessons, addMonthsStr } from "@/lib/billing";
describe("facturation des cours", () => {
  it("calcule le prix d'une séance selon le mode", () => {
    expect(lessonPrice("SESSION", 25, 90)).toBe(25);
    expect(lessonPrice("HOUR", 20, 90)).toBe(30);
    expect(lessonPrice("MONTH", 120, 60)).toBeNull();
    expect(lessonPrice("FREE", 20, 60)).toBeNull();
    expect(lessonPrice("SESSION", null, 60)).toBeNull();
  });
  it("situation mensuelle par séance : dû, payé, reste", () => {
    const lessons = [
      { date: "2026-10-03", status: "DONE", price: 25, incomeId: "p1" },
      { date: "2026-10-10", status: "DONE", price: 25, incomeId: null },
      { date: "2026-10-17", status: "CANCELLED", price: 25, incomeId: null },
      { date: "2026-10-24", status: "PLANNED", price: 25, incomeId: null },
      { date: "2026-09-26", status: "DONE", price: 25, incomeId: null },
    ];
    expect(monthSituation({ billingMode: "SESSION", rate: 25 }, lessons, 0, "2026-10")).toMatchObject({ sessions: 2, due: 50, paid: 25, remaining: 25 });
    expect(unpaidLessons(lessons).map((l) => l.date)).toEqual(["2026-10-10", "2026-09-26"]);
  });
  it("forfait mensuel : dû seulement s'il y a des séances ce mois-là", () => {
    const lessons = [{ date: "2026-10-03", status: "DONE", price: null, incomeId: null }];
    expect(monthSituation({ billingMode: "MONTH", rate: 120 }, lessons, 0, "2026-10")).toMatchObject({ due: 120, remaining: 120 });
    expect(monthSituation({ billingMode: "MONTH", rate: 120 }, lessons, 120, "2026-10")).toMatchObject({ due: 120, remaining: 0 });
    expect(monthSituation({ billingMode: "MONTH", rate: 120 }, lessons, 0, "2026-11")).toMatchObject({ due: 0 });
    expect(addMonthsStr("2026-12", 1)).toBe("2027-01");
  });
});

import { formatMoney } from "@/lib/billing";
describe("affichage des montants", () => {
  it("dinar tunisien en DT (jusqu'à 3 décimales), autres devises lisibles", () => {
    expect(formatMoney(45, "TND").replace(/\s/g, " ")).toBe("45 DT");
    expect(formatMoney(12.5, "TND").replace(/\s/g, " ")).toBe("12,5 DT");
    expect(formatMoney(1250, "TND").replace(/\s/g, " ")).toBe("1 250 DT");
    expect(formatMoney(2500, "DZD").replace(/\s/g, " ")).toBe("2 500 DA");
    expect(formatMoney(45).replace(/\s/g, " ")).toBe("45 DT");
    expect(formatMoney(30, "EUR")).toContain("€");
  });
});
