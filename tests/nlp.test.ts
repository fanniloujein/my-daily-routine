import { describe, expect, it } from "vitest";
import { parseMessage, parseDateExpr, parseTimeExpr, parseDurationExpr } from "@/lib/nlp";

const ctx = { today: "2026-10-12" }; // lundi

describe("analyse des phrases", () => {
  it("dates relatives", () => {
    expect(parseDateExpr("demain", ctx.today)).toBe("2026-10-13");
    expect(parseDateExpr("après-demain", ctx.today)).toBe("2026-10-14");
    expect(parseDateExpr("jeudi", ctx.today)).toBe("2026-10-15");
    expect(parseDateExpr("lundi prochain", ctx.today)).toBe("2026-10-19");
    expect(parseDateExpr("le 3 novembre", ctx.today)).toBe("2026-11-03");
    expect(parseDateExpr("le 5", ctx.today)).toBe("2026-11-05");
  });
  it("heures et durées", () => {
    expect(parseTimeExpr("à 17 h")).toBe("17:00");
    expect(parseTimeExpr("à 9h30")).toBe("09:30");
    expect(parseTimeExpr("je veux travailler trois heures")).toBeNull();
    expect(parseDurationExpr("trois heures sur mon projet")).toBe(180);
    expect(parseDurationExpr("pendant 30 minutes")).toBe(30);
    expect(parseDurationExpr("une demi-heure")).toBe(30);
  });
  it("« Demain, j'ai un cours particulier à 17 h. »", () => {
    const r = parseMessage("Demain, j'ai un cours particulier à 17 h.", ctx);
    expect(r.actions[0]).toMatchObject({ type: "create_activity", data: { categoryKind: "tutoring", date: "2026-10-13", startTime: "17:00", isFixed: true } });
  });
  it("« Je dois préparer un cours de mathématiques pour cet élève. »", () => {
    const r = parseMessage("Je dois préparer un cours de mathématiques pour cet élève.", ctx);
    expect(r.actions[0]).toMatchObject({ type: "prep_lesson", data: { subject: "Mathématiques" } });
  });
  it("« Je veux travailler trois heures sur mon projet web cette semaine. »", () => {
    const r = parseMessage("Je veux travailler trois heures sur mon projet web cette semaine.", ctx);
    expect(r.actions[0]).toMatchObject({ type: "weekly_goal", data: { categoryKind: "freelance", totalMinutes: 180 } });
  });
  it("« Aujourd'hui, je suis très fatiguée. »", () => {
    const r = parseMessage("Aujourd'hui, je suis très fatiguée.", ctx);
    expect(r.actions[0]).toMatchObject({ type: "set_energy", data: { energy: 1 } });
    expect(r.actions[1]).toMatchObject({ type: "plan_day", data: { light: true } });
  });
  it("« Je veux réviser l'allemand pendant 30 minutes. »", () => {
    const r = parseMessage("Je veux réviser l'allemand pendant 30 minutes.", ctx);
    expect(r.actions[0]).toMatchObject({ type: "german_session", data: { durationMin: 30 } });
  });
  it("« Supprime cette activité. » utilise le contexte et reste une action à confirmer", () => {
    const r = parseMessage("Supprime cette activité.", { ...ctx, lastActivityId: "abc", lastActivityDate: "2026-10-13" });
    expect(r.actions[0]).toEqual({ type: "delete_activity", data: { activityId: "abc", occurrenceDate: "2026-10-13" } });
    const r2 = parseMessage("Supprime cette activité.", ctx);
    expect(r2.actions).toEqual([]);
  });
  it("« Ajoute une nouvelle catégorie appelée Lecture. »", () => {
    const r = parseMessage("Ajoute une nouvelle catégorie appelée Lecture.", ctx);
    expect(r.actions[0]).toEqual({ type: "create_category", data: { name: "Lecture" } });
  });
});
