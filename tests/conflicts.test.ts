import { describe, expect, it } from "vitest";
import { findConflicts, findNextFreeSlot, freeSlots } from "@/lib/conflicts";

const items = [
  { id: "a", title: "Cours", startTime: "16:00", endTime: "17:00" },
  { id: "b", title: "Sport", startTime: "16:30", endTime: "17:15" },
  { id: "c", title: "Allemand", startTime: "17:15", endTime: "17:45" },
  { id: "d", title: "Sans horaire" },
];

describe("conflits", () => {
  it("détecte les chevauchements (bords exclus)", () => {
    const c = findConflicts(items);
    expect(c.map(([x, y]) => `${x.id}-${y.id}`)).toEqual(["a-b"]);
  });
  it("calcule les créneaux libres avec marge", () => {
    const slots = freeSlots(items, "15:00", "18:00", 10);
    expect(slots).toEqual([
      { start: 900, end: 950 },
      { start: 1075, end: 1080 },
    ]);
  });
  it("propose le prochain créneau libre réel", () => {
    expect(findNextFreeSlot(items, 60, "15:00", "20:00", 10)).toEqual({ startTime: "17:55", endTime: "18:55" });
    expect(findNextFreeSlot(items, 300, "15:00", "20:00", 10)).toBeNull();
  });
});
