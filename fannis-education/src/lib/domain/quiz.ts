/**
 * Correction des QCM — exécutée uniquement côté serveur.
 */
export interface GradableQuestion {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  options: string[];
  correctOptions: number[];
  points: number;
}

export type Answers = Record<string, number[]>;

export interface GradeResult {
  score: number;
  maxScore: number;
  percentage: number;
  perQuestion: Record<string, { correct: boolean; earned: number }>;
}

/** Normalise les réponses : indices valides, uniques, triés ; une seule réponse pour un choix unique. */
export function sanitizeAnswers(questions: GradableQuestion[], raw: unknown): Answers {
  const out: Answers = {};
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const q of questions) {
    const v = obj[q.id];
    const arr = Array.isArray(v) ? v : [];
    let idx = Array.from(
      new Set(arr.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < q.options.length)),
    ).sort((a, b) => a - b);
    if (q.type === "SINGLE_CHOICE") idx = idx.slice(0, 1);
    out[q.id] = idx;
  }
  return out;
}

/** Tout ou rien par question : la réponse doit correspondre exactement aux bonnes propositions. */
export function gradeQuiz(questions: GradableQuestion[], answers: Answers): GradeResult {
  let score = 0;
  let maxScore = 0;
  const perQuestion: GradeResult["perQuestion"] = {};
  for (const q of questions) {
    maxScore += q.points;
    const given = [...(answers[q.id] ?? [])].sort((a, b) => a - b);
    const expected = [...q.correctOptions].sort((a, b) => a - b);
    const correct = given.length === expected.length && given.every((v, i) => v === expected[i]);
    const earned = correct ? q.points : 0;
    score += earned;
    perQuestion[q.id] = { correct, earned };
  }
  const percentage = maxScore === 0 ? 0 : Math.round((score / maxScore) * 1000) / 10;
  return { score, maxScore, percentage, perQuestion };
}
