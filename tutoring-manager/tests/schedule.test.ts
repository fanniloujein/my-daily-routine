import { describe, expect, it } from "vitest";
import { busyMinutes, breakSuggestions, expandWeekly, findConflicts, freeSlots, loadLevel, nextFreeSlot, weeklyDates } from "@/lib/schedule";
import { addDays, endOfMonth, isDate, startOfWeek, weekday } from "@/lib/dates";

const b = (date: string, s: string, e: string, id?: string) => ({ id, date, startTime: s, endTime: e });

describe("dates", () => {
  it("semaines et mois", () => {
    expect(weekday("2026-11-21")).toBe(6); // samedi
    expect(startOfWeek("2026-11-21")).toBe("2026-11-16");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(isDate("2026-02-30")).toBe(false);
  });
});

describe("conflits horaires", () => {
  const busy = [b("2026-11-23", "14:00", "15:00", "x"), b("2026-11-23", "16:00", "17:30", "y")];
  it("détecte un chevauchement", () => {
    expect(findConflicts(b("2026-11-23", "14:30", "15:30"), busy).map((c) => c.id)).toEqual(["x"]);
  });
  it("des séances bout à bout ne sont pas en conflit", () => {
    expect(findConflicts(b("2026-11-23", "15:00", "16:00"), busy)).toHaveLength(0);
  });
  it("ignore la séance elle-même lors d'une modification", () => {
    expect(findConflicts(b("2026-11-23", "14:15", "14:45", "x"), busy)).toHaveLength(0);
  });
});

describe("créneaux libres", () => {
  const busy = [b("2026-11-23", "10:00", "11:00"), b("2026-11-23", "10:30", "12:00")];
  it("liste les trous de la journée", () => {
    expect(freeSlots("2026-11-23", busy, "08:00", "14:00", 30)).toEqual([
      { startTime: "08:00", endTime: "10:00", minutes: 120 },
      { startTime: "12:00", endTime: "14:00", minutes: 120 },
    ]);
  });
  it("trouve le prochain créneau d'une durée donnée", () => {
    const full = [b("2026-11-23", "08:00", "20:00")];
    expect(nextFreeSlot("2026-11-23", 90, full, "08:00", "20:00")).toEqual({ date: "2026-11-24", startTime: "08:00", endTime: "09:30" });
  });
  it("fusionne les chevauchements pour la charge", () => {
    expect(busyMinutes("2026-11-23", busy)).toBe(120);
    expect(loadLevel(400, 6)).toBe("OVERLOADED");
    expect(loadLevel(300, 6)).toBe("BUSY");
  });
});

describe("récurrences", () => {
  it("lundi et jeudi jusqu'à une date", () => {
    expect(weeklyDates("2026-11-23", [1, 4], "2026-12-03")).toEqual(["2026-11-23", "2026-11-26", "2026-11-30", "2026-12-03"]);
  });
  it("développe un événement hebdomadaire sur une période", () => {
    const ev = [{ ...b("2026-11-02", "12:00", "13:00"), weeklyUntil: "2026-12-31" }];
    expect(expandWeekly(ev, "2026-11-20", "2026-12-01").map((e) => e.date)).toEqual(["2026-11-23", "2026-11-30"]);
  });
  it("suggère des pauses entre séances rapprochées", () => {
    expect(breakSuggestions([b("2026-11-23", "14:00", "15:00"), b("2026-11-23", "15:05", "16:00")], 15)).toEqual([{ date: "2026-11-23", after: "15:00", gap: 5 }]);
  });
});
