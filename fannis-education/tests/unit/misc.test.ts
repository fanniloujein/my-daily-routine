import { describe, expect, it } from "vitest";
import { gradeQuiz, sanitizeAnswers, type GradableQuestion } from "@/lib/domain/quiz";
import { formatMoney, millimesToTndString, parseTndToMillimes } from "@/lib/money";
import { dayOfWeekOf, hhmmToMinutes, isValidIsoDate, toLocalIsoDate, zonedTimeToUtc } from "@/lib/time";
import { questionSchema } from "@/lib/validation/content";
import { dictionaries } from "@/lib/i18n/dict";

describe("QCM — correction serveur", () => {
  const qs: GradableQuestion[] = [
    { id: "a", type: "SINGLE_CHOICE", options: ["x", "y", "z"], correctOptions: [1], points: 1 },
    { id: "b", type: "MULTIPLE_CHOICE", options: ["x", "y", "z"], correctOptions: [0, 2], points: 2 },
  ];
  it("tout ou rien par question", () => {
    expect(gradeQuiz(qs, { a: [1], b: [2, 0] })).toMatchObject({ score: 3, maxScore: 3, percentage: 100 });
    expect(gradeQuiz(qs, { a: [1], b: [0] })).toMatchObject({ score: 1, percentage: 33.3 });
    expect(gradeQuiz(qs, {})).toMatchObject({ score: 0 });
  });
  it("nettoie les réponses malveillantes (index hors bornes, doublons, plusieurs réponses à un choix unique)", () => {
    const clean = sanitizeAnswers(qs, { a: [0, 1], b: [2, 2, 0, 99, -1, "1"], zzz: [1] });
    expect(clean).toEqual({ a: [0], b: [0, 2] });
    expect(sanitizeAnswers(qs, "garbage")).toEqual({ a: [], b: [] });
  });
});

describe("montants (millimes)", () => {
  it("parse les saisies en dinars", () => {
    expect(parseTndToMillimes("10")).toBe(10_000);
    expect(parseTndToMillimes("12,5")).toBe(12_500);
    expect(parseTndToMillimes("0.125")).toBe(125);
    expect(parseTndToMillimes("-3")).toBeNull();
    expect(parseTndToMillimes("1.2345")).toBeNull();
    expect(parseTndToMillimes("abc")).toBeNull();
  });
  it("formate", () => {
    expect(formatMoney(10_000, "fr")).toBe("10 DT");
    expect(formatMoney(10_000, "ar")).toContain("د.ت");
    expect(millimesToTndString(12_500)).toBe("12.5");
  });
});

describe("dates (Africa/Tunis)", () => {
  it("convertit heure locale ↔ UTC", () => {
    expect(zonedTimeToUtc("2026-07-01", 9 * 60).toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(toLocalIsoDate(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
  });
  it("valide les dates et heures", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(hhmmToMinutes("17:30")).toBe(1050);
    expect(hhmmToMinutes("25:00")).toBeNull();
    expect(dayOfWeekOf("2026-03-16")).toBe(1);
  });
});

describe("questions de QCM (validation admin)", () => {
  it("retire les propositions vides et réindexe les bonnes réponses", () => {
    const r = questionSchema.parse({ prompt: "Q", type: "SINGLE_CHOICE", options: ["", "A", "", "B"], correct: [3], points: 1 });
    expect(r.options).toEqual(["A", "B"]);
    expect(r.correct).toEqual([1]);
  });
  it("exige au moins deux propositions et une bonne réponse", () => {
    expect(questionSchema.safeParse({ prompt: "Q", type: "SINGLE_CHOICE", options: ["A"], correct: [0], points: 1 }).success).toBe(false);
    expect(questionSchema.safeParse({ prompt: "Q", type: "SINGLE_CHOICE", options: ["A", "B"], correct: [], points: 1 }).success).toBe(false);
  });
});

describe("dictionnaires FR / AR", () => {
  it("l'arabe couvre toutes les clés du français, sans valeur vide", () => {
    const walk = (fr: unknown, ar: unknown, path: string) => {
      if (typeof fr === "string") {
        expect(typeof ar, path).toBe("string");
        expect((ar as string).length, path).toBeGreaterThan(0);
        return;
      }
      if (Array.isArray(fr)) {
        expect(Array.isArray(ar), path).toBe(true);
        expect((ar as unknown[]).length, path).toBe(fr.length);
        fr.forEach((v, i) => walk(v, (ar as unknown[])[i], `${path}[${i}]`));
        return;
      }
      for (const k of Object.keys(fr as object)) walk((fr as Record<string, unknown>)[k], (ar as Record<string, unknown>)?.[k], `${path}.${k}`);
    };
    walk(dictionaries.fr, dictionaries.ar, "dict");
  });
});
