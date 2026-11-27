import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/action";
import { gradeQuiz, sanitizeAnswers, type GradableQuestion } from "@/lib/domain/quiz";
import { canAccessContent } from "@/lib/domain/subscription";
import { hasPremium } from "./subscriptions";

function toGradable(q: { id: string; type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE"; options: unknown; correctOptions: number[]; points: number }): GradableQuestion {
  return {
    id: q.id,
    type: q.type,
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
    correctOptions: q.correctOptions,
    points: q.points,
  };
}

/** Corrige côté serveur et enregistre la tentative. Les bonnes réponses ne sont jamais lues depuis le client. */
export async function submitQuizAttempt(input: {
  quizId: string;
  user: { id: string; role: "STUDENT" | "TEACHER" | "ADMIN" };
  answers: unknown;
  startedAt: Date;
}) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: input.quizId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!quiz || (quiz.status !== "PUBLISHED" && input.user.role !== "ADMIN")) throw new AppError("notFound");
  const premium = input.user.role === "STUDENT" ? await hasPremium(input.user.id) : false;
  if (!canAccessContent({ accessLevel: quiz.accessLevel, role: input.user.role, hasPremium: premium, isAuthor: quiz.authorId === input.user.id })) {
    throw new AppError("forbidden");
  }
  if (quiz.questions.length === 0) throw new AppError("quizEmpty");

  const questions = quiz.questions.map(toGradable);
  const answers = sanitizeAnswers(questions, input.answers);
  const result = gradeQuiz(questions, answers);
  const now = new Date();
  const startedAt = input.startedAt > now || now.getTime() - input.startedAt.getTime() > 86_400_000 ? now : input.startedAt;

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id,
      userId: input.user.id,
      answers,
      score: result.score,
      maxScore: result.maxScore,
      percentage: result.percentage,
      startedAt,
      completedAt: now,
    },
  });
  return { attempt, result };
}
