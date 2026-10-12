import { describe, expect, it } from "vitest";
import { expandDates, occursOn } from "@/lib/recurrence";

describe("récurrences", () => {
  it("quotidienne avec intervalle", () => {
    const r = { date: "2026-10-12", recurrence: "DAILY" as const, interval: 2, weekdays: [] };
    expect(expandDates(r, "2026-10-12", "2026-10-18")).toEqual(["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-18"]);
  });
  it("hebdomadaire sur plusieurs jours", () => {
    const r = { date: "2026-10-12", recurrence: "WEEKLY" as const, interval: 1, weekdays: [1, 3, 5] };
    expect(expandDates(r, "2026-10-12", "2026-10-25")).toEqual(["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-19", "2026-10-21", "2026-10-23"]);
  });
  it("toutes les 2 semaines, jour de départ par défaut", () => {
    const r = { date: "2026-10-13", recurrence: "WEEKLY" as const, interval: 2, weekdays: [] };
    expect(expandDates(r, "2026-10-01", "2026-11-15")).toEqual(["2026-10-13", "2026-10-27", "2026-11-10"]);
  });
  it("respecte la date de fin et la date de début", () => {
    const r = { date: "2026-10-12", recurrence: "DAILY" as const, interval: 1, weekdays: [], until: "2026-10-14" };
    expect(expandDates(r, "2026-10-01", "2026-10-31")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
    expect(occursOn(r, "2026-10-11")).toBe(false);
  });
  it("activité unique", () => {
    const r = { date: "2026-10-12", recurrence: "NONE" as const, interval: 1, weekdays: [] };
    expect(expandDates(r, "2026-10-13", "2026-10-20")).toEqual([]);
  });
});
