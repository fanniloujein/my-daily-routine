import { describe, expect, it } from "vitest";
import { planDay, splitDuration, type PlanInput } from "@/lib/planner";
import { timeToMin } from "@/lib/dates";
import { findConflicts } from "@/lib/conflicts";

const base: PlanInput = {
  date: "2026-10-12",
  energy: 3,
  settings: { dayStart: "08:00", workEnd: "19:00", dayEnd: "22:30", breakMin: 10, lunchStart: "12:30", lunchEnd: "13:30" },
  fixed: [{ id: "cours", title: "Cours particulier", startTime: "16:00", endTime: "17:00" }],
  tasks: [
    { id: "t1", occurrenceDate: "2026-10-12", title: "Développer le frontend", durationMin: 180, priority: 3, energyCost: 3 },
    { id: "t2", occurrenceDate: "2026-10-12", title: "Facture client", durationMin: 20, priority: 4, energyCost: 1, dueDate: "2026-10-12" },
    { id: "t3", occurrenceDate: "2026-10-12", title: "Ranger les papiers", durationMin: 60, priority: 1, energyCost: 2 },
    { id: "t4", occurrenceDate: "2026-10-12", title: "Préparer le cours", durationMin: 45, priority: 3, energyCost: 2, dueDate: "2026-10-13", categoryKind: "prep" },
  ],
};

function noOverlap(blocks: { key: string; title: string; startTime: string; endTime: string; kind: string }[]) {
  const timed = blocks.filter((b) => b.kind !== "break").map((b) => ({ id: b.key, title: b.title, startTime: b.startTime, endTime: b.endTime }));
  return findConflicts(timed).length === 0;
}

describe("planificateur", () => {
  it("ne déplace jamais les rendez-vous fixes et n'a aucun chevauchement", () => {
    const plan = planDay(base);
    const fixed = plan.blocks.find((b) => b.refId === "cours")!;
    expect(fixed.startTime).toBe("16:00");
    expect(fixed.kind).toBe("fixed");
    expect(noOverlap(plan.blocks)).toBe(true);
  });
  it("place l'urgent en premier et respecte la pause déjeuner", () => {
    const plan = planDay(base);
    const tasks = plan.blocks.filter((b) => b.kind === "task");
    expect(tasks[0].refId).toBe("t2");
    expect(plan.blocks.some((b) => b.kind === "meal")).toBe(true);
    for (const t of tasks) expect(timeToMin(t.endTime) <= timeToMin("12:30") || timeToMin(t.startTime) >= timeToMin("13:30")).toBe(true);
  });
  it("découpe les grosses tâches en étapes", () => {
    expect(splitDuration(180, 50)).toEqual([45, 45, 45, 45]);
    expect(splitDuration(100, 90)).toEqual([50, 50]);
    const plan = planDay(base);
    const parts = plan.blocks.filter((b) => b.refId === "t1");
    expect(parts.length).toBeGreaterThan(1);
  });
  it("énergie faible : garde l'urgent, reporte le flexible non urgent, ajoute du repos", () => {
    const plan = planDay({ ...base, energy: 2 });
    const placed = new Set(plan.blocks.filter((b) => b.kind === "task").map((b) => b.refId));
    expect(placed.has("t2")).toBe(true);
    expect(placed.has("t3")).toBe(false);
    expect(plan.postponed.map((p) => p.id)).toContain("t3");
    expect(plan.blocks.some((b) => b.kind === "rest")).toBe(true);
    expect(plan.focusMinutes).toBeLessThanOrEqual(120);
    expect(noOverlap(plan.blocks)).toBe(true);
  });
  it("énergie très faible : conserve une petite tâche prioritaire réaliste", () => {
    const plan = planDay({ ...base, energy: 1, tasks: base.tasks.filter((t) => t.id !== "t2") });
    const placed = plan.blocks.filter((b) => b.kind === "task");
    expect(placed.length).toBeGreaterThanOrEqual(1);
    expect(plan.focusMinutes).toBeLessThanOrEqual(45);
  });
  it("mode journée légère : programme minimal", () => {
    const plan = planDay({ ...base, light: true });
    expect(plan.focusMinutes).toBeLessThanOrEqual(30);
    expect(plan.messages[0]).toMatch(/journée légère/);
  });
  it("bonne énergie : propose allemand et sport si les objectifs le permettent", () => {
    const plan = planDay({
      ...base,
      energy: 5,
      goals: { germanMinutesLeft: 60, sportSessionsLeft: 1, sportDuration: 45, sportDayAvailable: true, sportPreferredTime: "18:00" },
    });
    expect(plan.blocks.some((b) => b.suggestion === "german")).toBe(true);
    const sport = plan.blocks.find((b) => b.suggestion === "sport");
    expect(sport?.startTime).toBe("18:00");
    expect(noOverlap(plan.blocks)).toBe(true);
  });
  it("ne planifie rien avant l'heure actuelle", () => {
    const plan = planDay({ ...base, notBefore: "14:00" });
    for (const b of plan.blocks.filter((x) => x.kind === "task")) expect(timeToMin(b.startTime)).toBeGreaterThanOrEqual(timeToMin("14:00"));
  });
});
