import { describe, expect, it } from "vitest";
import { checkTransition, findAvailabilityOverlap, generateSlots, isSlotOffered, lessonPrice, overlaps } from "@/lib/domain/booking";
import { zonedTimeToUtc } from "@/lib/time";

const MONDAY = "2026-03-16"; // lundi
const now = new Date("2026-03-14T08:00:00Z");
const both = { online: true, inPerson: true };
const evening = { dayOfWeek: 1, startMinute: 17 * 60, endMinute: 20 * 60, mode: null };

describe("chevauchement", () => {
  const a = { startsAt: new Date("2026-03-16T16:00:00Z"), endsAt: new Date("2026-03-16T17:00:00Z") };
  it("détecte un chevauchement partiel", () => {
    expect(overlaps(a, { startsAt: new Date("2026-03-16T16:30:00Z"), endsAt: new Date("2026-03-16T17:30:00Z") })).toBe(true);
  });
  it("deux séances qui se touchent ne se chevauchent pas", () => {
    expect(overlaps(a, { startsAt: a.endsAt, endsAt: new Date("2026-03-16T18:00:00Z") })).toBe(false);
  });
  it("une séance incluse se chevauche", () => {
    expect(overlaps(a, { startsAt: new Date("2026-03-16T16:15:00Z"), endsAt: new Date("2026-03-16T16:45:00Z") })).toBe(true);
  });
});

describe("génération des créneaux", () => {
  it("découpe la disponibilité en séances (heure de Tunis, UTC+1)", () => {
    const slots = generateSlots({ date: MONDAY, availabilities: [evening], durationMinutes: 60, busy: [], now, teacherModes: both });
    expect(slots).toHaveLength(3);
    expect(slots[0].startsAt.toISOString()).toBe("2026-03-16T16:00:00.000Z");
    expect(slots[2].endsAt.toISOString()).toBe("2026-03-16T19:00:00.000Z");
    expect(slots[0].modes).toEqual(["ONLINE", "IN_PERSON"]);
  });
  it("ignore les autres jours", () => {
    expect(generateSlots({ date: "2026-03-17", availabilities: [evening], durationMinutes: 60, busy: [], now, teacherModes: both })).toHaveLength(0);
  });
  it("retire les créneaux déjà occupés (anti double réservation)", () => {
    const busy = [{ startsAt: zonedTimeToUtc(MONDAY, 18 * 60), endsAt: zonedTimeToUtc(MONDAY, 19 * 60) }];
    const slots = generateSlots({ date: MONDAY, availabilities: [evening], durationMinutes: 60, busy, now, teacherModes: both });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(["2026-03-16T16:00:00.000Z", "2026-03-16T18:00:00.000Z"]);
  });
  it("retire les créneaux trop proches (délai de prévenance)", () => {
    const late = new Date("2026-03-16T10:00:00Z"); // + 7 h de délai → premier créneau possible à 17:00Z
    const slots = generateSlots({ date: MONDAY, availabilities: [evening], durationMinutes: 60, busy: [], now: late, teacherModes: both, minLeadMinutes: 7 * 60 });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(["2026-03-16T17:00:00.000Z", "2026-03-16T18:00:00.000Z"]);
  });
  it("respecte les modes proposés par l'enseignant", () => {
    const slots = generateSlots({ date: MONDAY, availabilities: [{ ...evening, mode: "IN_PERSON" }], durationMinutes: 60, busy: [], now, teacherModes: { online: true, inPerson: false } });
    expect(slots).toHaveLength(0);
  });
  it("une séance qui dépasserait la plage n'est pas proposée", () => {
    const slots = generateSlots({ date: MONDAY, availabilities: [evening], durationMinutes: 90, busy: [], now, teacherModes: both });
    expect(slots).toHaveLength(2);
  });
  it("isSlotOffered vérifie l'heure exacte et le mode", () => {
    const slots = generateSlots({ date: MONDAY, availabilities: [{ ...evening, mode: "ONLINE" }], durationMinutes: 60, busy: [], now, teacherModes: both });
    expect(isSlotOffered(slots, slots[0].startsAt, "ONLINE")).not.toBeNull();
    expect(isSlotOffered(slots, slots[0].startsAt, "IN_PERSON")).toBeNull();
    expect(isSlotOffered(slots, new Date(slots[0].startsAt.getTime() + 60_000), "ONLINE")).toBeNull();
  });
});

describe("prix", () => {
  it("vient du profil enseignant selon le mode", () => {
    const t = { onlinePriceMillimes: 25_000, inPersonPriceMillimes: null };
    expect(lessonPrice("ONLINE", t)).toBe(25_000);
    expect(lessonPrice("IN_PERSON", t)).toBeNull();
  });
});

describe("machine à états des réservations", () => {
  const future = { startsAt: new Date(now.getTime() + 3 * 86_400_000), endsAt: new Date(now.getTime() + 3 * 86_400_000 + 3_600_000) };
  const past = { startsAt: new Date(now.getTime() - 7_200_000), endsAt: new Date(now.getTime() - 3_600_000) };
  it("seul l'enseignant accepte ou refuse une demande", () => {
    expect(checkTransition({ from: "PENDING", to: "ACCEPTED", actor: "TEACHER", booking: future, now }).ok).toBe(true);
    expect(checkTransition({ from: "PENDING", to: "ACCEPTED", actor: "STUDENT", booking: future, now })).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(checkTransition({ from: "PENDING", to: "REJECTED", actor: "ADMIN", booking: future, now }).ok).toBe(false);
  });
  it("tout le monde peut annuler une demande en attente", () => {
    for (const actor of ["STUDENT", "TEACHER", "ADMIN"] as const) expect(checkTransition({ from: "PENDING", to: "CANCELLED", actor, booking: future, now }).ok).toBe(true);
  });
  it("l'élève ne peut plus annuler une séance acceptée moins de 24 h avant", () => {
    const soon = { startsAt: new Date(now.getTime() + 5 * 3_600_000), endsAt: new Date(now.getTime() + 6 * 3_600_000) };
    expect(checkTransition({ from: "ACCEPTED", to: "CANCELLED", actor: "STUDENT", booking: soon, now })).toEqual({ ok: false, reason: "TOO_LATE_TO_CANCEL" });
    expect(checkTransition({ from: "ACCEPTED", to: "CANCELLED", actor: "STUDENT", booking: future, now }).ok).toBe(true);
    expect(checkTransition({ from: "ACCEPTED", to: "CANCELLED", actor: "TEACHER", booking: soon, now }).ok).toBe(true);
  });
  it("une séance ne peut être terminée qu'après sa fin, et pas par l'élève", () => {
    expect(checkTransition({ from: "ACCEPTED", to: "COMPLETED", actor: "TEACHER", booking: future, now })).toEqual({ ok: false, reason: "NOT_FINISHED" });
    expect(checkTransition({ from: "ACCEPTED", to: "COMPLETED", actor: "TEACHER", booking: past, now }).ok).toBe(true);
    expect(checkTransition({ from: "ACCEPTED", to: "COMPLETED", actor: "STUDENT", booking: past, now }).ok).toBe(false);
  });
  it("les états finaux sont définitifs", () => {
    for (const from of ["REJECTED", "COMPLETED", "CANCELLED"] as const) {
      for (const to of ["PENDING", "ACCEPTED", "CANCELLED", "COMPLETED"] as const) {
        expect(checkTransition({ from, to, actor: "ADMIN", booking: past, now }).ok).toBe(false);
      }
    }
  });
  it("impossible de revenir à PENDING ou de sauter d'ACCEPTED à REJECTED", () => {
    expect(checkTransition({ from: "ACCEPTED", to: "REJECTED", actor: "TEACHER", booking: future, now }).ok).toBe(false);
    expect(checkTransition({ from: "PENDING", to: "COMPLETED", actor: "TEACHER", booking: past, now }).ok).toBe(false);
  });
});

describe("disponibilités", () => {
  it("détecte deux plages qui se chevauchent le même jour", () => {
    expect(findAvailabilityOverlap([evening, { dayOfWeek: 1, startMinute: 19 * 60, endMinute: 21 * 60, mode: null }])).toEqual([0, 1]);
    expect(findAvailabilityOverlap([evening, { dayOfWeek: 1, startMinute: 20 * 60, endMinute: 21 * 60, mode: null }])).toBeNull();
    expect(findAvailabilityOverlap([evening, { ...evening, dayOfWeek: 2 }])).toBeNull();
  });
});
