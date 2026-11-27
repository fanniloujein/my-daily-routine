"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitQuizAction } from "@/actions/student";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { fmt } from "@/lib/i18n/config";
import { useErrorText, useI18n } from "@/lib/i18n/client";

export type PublicQuestion = { id: string; prompt: string; type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE"; options: string[] };

/** Les questions reçues ne contiennent PAS les bonnes réponses : la correction est faite par le serveur. */
export function QuizRunner({ quizId, questions }: { quizId: string; questions: PublicQuestion[] }) {
  const { t } = useI18n();
  const err = useErrorText();
  const router = useRouter();
  const startedAt = useMemo(() => new Date().toISOString(), []);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const s = t.student;

  function toggle(q: PublicQuestion, i: number) {
    setAnswers((a) => {
      const cur = a[q.id] ?? [];
      if (q.type === "SINGLE_CHOICE") return { ...a, [q.id]: [i] };
      return { ...a, [q.id]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] };
    });
  }

  function submit() {
    const missing = questions.filter((q) => !(answers[q.id]?.length)).length;
    if (missing > 0 && !window.confirm(fmt(s.quizUnanswered, { count: missing }))) return;
    setError(undefined);
    start(async () => {
      const res = await submitQuizAction(quizId, answers, startedAt);
      if (res.ok && res.data) router.push(`/student/quizzes/attempts/${res.data.attemptId}`);
      else if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-5">
      {questions.map((q, qi) => (
        <fieldset key={q.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
          <legend className="sr-only">{q.prompt}</legend>
          <p className="text-xs font-medium text-brand-600">{qi + 1} / {questions.length} · {q.type === "SINGLE_CHOICE" ? s.quizSingle : s.quizMultiple}</p>
          <p className="mt-1.5 font-medium">{q.prompt}</p>
          <div className="mt-4 space-y-2">
            {q.options.map((opt, i) => {
              const checked = answers[q.id]?.includes(i) ?? false;
              return (
                <label key={i} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition", checked ? "border-brand-300 bg-brand-50" : "border-gray-200 hover:border-brand-200")}>
                  <input
                    type={q.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                    name={q.id}
                    checked={checked}
                    onChange={() => toggle(q, i)}
                    className="mt-0.5 h-4 w-4 text-brand-600"
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      {error && <Alert tone="red">{err(error)}</Alert>}
      <Button size="lg" onClick={submit} disabled={pending} className="w-full sm:w-auto">
        {pending ? s.quizSubmitting : s.quizSubmit}
      </Button>
    </div>
  );
}
