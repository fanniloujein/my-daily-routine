import { describe, expect, it } from "vitest";
import { addDays, diffDays, endOfMonth, formatDuration, isValidDateStr, isValidTimeStr, startOfWeek, timeToMin, minToTime } from "@/lib/dates";

describe("dates", () => {
  it("additionne les jours en traversant mois, années et changement d'heure", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30"); // passage à l'heure d'été (Europe)
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26"); // passage à l'heure d'hiver
    expect(diffDays("2026-11-01", "2026-10-25")).toBe(7);
  });
  it("trouve le lundi de la semaine", () => {
    expect(startOfWeek("2026-10-12")).toBe("2026-10-12"); // lundi
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12"); // dimanche
    expect(startOfWeek("2026-10-14")).toBe("2026-10-12");
  });
  it("valide les formats", () => {
    expect(isValidDateStr("2026-02-29")).toBe(false);
    expect(isValidDateStr("2028-02-29")).toBe(true);
    expect(isValidTimeStr("24:00")).toBe(false);
    expect(isValidTimeStr("09:05")).toBe(true);
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
  });
  it("convertit heures et durées", () => {
    expect(timeToMin("17:30")).toBe(1050);
    expect(minToTime(1050)).toBe("17:30");
    expect(formatDuration(90)).toBe("1 h 30");
    expect(formatDuration(45)).toBe("45 min");
  });
});

import { roundUpTime } from "@/lib/dates";
describe("arrondi des heures", () => {
  it("arrondit au quart d'heure supérieur", () => {
    expect(roundUpTime("19:23")).toBe("19:30");
    expect(roundUpTime("19:30")).toBe("19:30");
    expect(roundUpTime("23:50")).toBe("23:59");
  });
});
