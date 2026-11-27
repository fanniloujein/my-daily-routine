"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCourseAction, createQuizAction, createResourceAction, saveLessonAction, saveQuestionAction, updateCourseAction, updateQuizAction } from "@/actions/content";
import { courseSchema, lessonSchema, questionSchema, quizSchema, type CourseInput, type LessonInput, type QuestionInput, type QuizInput } from "@/lib/validation/content";
import { Alert, Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { applyServerErrors } from "./form";
import { useToast } from "./Toaster";

type Option = { id: string; label: string };

function useSubmitHelpers() {
  const { t } = useI18n();
  const err = useErrorText();
  const toast = useToast();
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  return { t, err, toast, router, formError, setFormError };
}

function AccessSelect({ id, register }: { id: string; register: object }) {
  const { t } = useI18n();
  return (
    <select id={id} className="input" {...register}>
      <option value="PREMIUM">{t.enums.accessLevel.PREMIUM}</option>
      <option value="FREE">{t.enums.accessLevel.FREE}</option>
    </select>
  );
}

// ─────────── Cours ───────────
export function CourseForm({ subjects, defaults, courseId, isAdmin, redirectBase }: { subjects: Option[]; defaults?: Partial<CourseInput>; courseId?: string; isAdmin: boolean; redirectBase: string }) {
  const { t, err, toast, router, formError, setFormError } = useSubmitHelpers();
  const a = t.admin;
  const { register, handleSubmit, setError, formState } = useForm<CourseInput>({
    resolver: zodResolver(courseSchema, undefined, { raw: true }),
    defaultValues: { subjectId: subjects[0]?.id ?? "", accessLevel: "PREMIUM", title: "", summary: "", isDemo: false, ...defaults },
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setFormError(undefined);
        const res = courseId ? await updateCourseAction(courseId, v) : await createCourseAction(v);
        if (!res.ok) return setFormError(applyServerErrors(res, setError));
        toast(t.common.saved);
        if (!courseId && res.data && "id" in (res.data as object)) router.push(`${redirectBase}/${(res.data as { id: string }).id}`);
        else router.refresh();
      })}
    >
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={a.courseTitle} htmlFor="title" error={err(formState.errors.title?.message)} className="sm:col-span-2"><input id="title" className="input" {...register("title")} /></Field>
        <Field label={a.subject} htmlFor="subjectId" error={err(formState.errors.subjectId?.message)}>
          <select id="subjectId" className="input" {...register("subjectId")}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </Field>
        <Field label={a.access} htmlFor="accessLevel"><AccessSelect id="accessLevel" register={register("accessLevel")} /></Field>
        <Field label={a.courseSummary} htmlFor="summary" error={err(formState.errors.summary?.message)} className="sm:col-span-2"><textarea id="summary" rows={2} className="input" {...register("summary")} /></Field>
      </div>
      {isAdmin && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded" {...register("isDemo")} /> {a.isDemo}</label>
      )}
      <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? t.common.saving : courseId ? t.common.save : t.common.create}</Button>
    </form>
  );
}

// ─────────── Leçons ───────────
export function LessonForm({ courseId, lessonId, defaults, onDone }: { courseId: string; lessonId?: string; defaults?: Partial<LessonInput>; onDone?: () => void }) {
  const { t, err, toast, router, formError, setFormError } = useSubmitHelpers();
  const a = t.admin;
  const { register, handleSubmit, setError, reset, formState } = useForm<LessonInput>({
    resolver: zodResolver(lessonSchema, undefined, { raw: true }),
    defaultValues: { title: "", content: "", accessLevel: "PREMIUM", durationMinutes: "", ...defaults },
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setFormError(undefined);
        const res = await saveLessonAction(courseId, lessonId ?? null, v);
        if (!res.ok) return setFormError(applyServerErrors(res, setError));
        toast(t.common.saved);
        if (!lessonId) reset();
        onDone?.();
        router.refresh();
      })}
    >
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px_160px]">
        <Field label={a.lessonTitle} htmlFor={`lt-${lessonId ?? "new"}`} error={err(formState.errors.title?.message)}><input id={`lt-${lessonId ?? "new"}`} className="input" {...register("title")} /></Field>
        <Field label={a.lessonDuration} htmlFor={`ld-${lessonId ?? "new"}`} error={err(formState.errors.durationMinutes?.message)}><input id={`ld-${lessonId ?? "new"}`} type="number" min={1} className="input" {...register("durationMinutes")} /></Field>
        <Field label={a.access} htmlFor={`la-${lessonId ?? "new"}`}><AccessSelect id={`la-${lessonId ?? "new"}`} register={register("accessLevel")} /></Field>
      </div>
      <Field label={a.lessonContent} htmlFor={`lc-${lessonId ?? "new"}`} hint={a.lessonContentHint} error={err(formState.errors.content?.message)}>
        <textarea id={`lc-${lessonId ?? "new"}`} rows={10} className="input font-mono text-[13px]" {...register("content")} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? t.common.saving : lessonId ? t.common.save : a.newLesson}</Button>
        {onDone && <Button variant="ghost" onClick={onDone}>{t.common.cancel}</Button>}
      </div>
    </form>
  );
}

export function EditLessonToggle({ courseId, lesson, label }: { courseId: string; lesson: { id: string; title: string; content: string; accessLevel: "FREE" | "PREMIUM"; durationMinutes: number | null }; label: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <div className="mt-3 w-full rounded-xl border border-gray-100 bg-surface p-4">
      <LessonForm courseId={courseId} lessonId={lesson.id} defaults={{ title: lesson.title, content: lesson.content, accessLevel: lesson.accessLevel, durationMinutes: lesson.durationMinutes ?? "" }} onDone={() => setOpen(false)} />
    </div>
  );
}

// ─────────── Ressources (PDF) ───────────
type ResourceValues = { subjectId: string; courseId: string; title: string; description: string; type: string; accessLevel: string; isDemo: boolean; publishNow: boolean; file: FileList };

export function ResourceUploadForm({ subjects, courses, isAdmin }: { subjects: Option[]; courses: (Option & { subjectId: string })[]; isAdmin: boolean }) {
  const { t, err, toast, router, formError, setFormError } = useSubmitHelpers();
  const a = t.admin;
  const { register, handleSubmit, setError, reset, control, formState } = useForm<ResourceValues>({
    defaultValues: { subjectId: subjects[0]?.id ?? "", courseId: "", type: "REVISION_SHEET", accessLevel: "PREMIUM", isDemo: false, publishNow: isAdmin },
  });
  const subjectId = useWatch({ control, name: "subjectId" });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setFormError(undefined);
        const file = v.file?.[0];
        if (!file) return setError("file", { message: "fileRequired" });
        if (file.size > 10 * 1024 * 1024) return setError("file", { message: "fileTooLarge" });
        const fd = new FormData();
        for (const k of ["subjectId", "courseId", "title", "description", "type", "accessLevel"] as const) fd.set(k, v[k] ?? "");
        if (v.isDemo) fd.set("isDemo", "on");
        if (v.publishNow) fd.set("publishNow", "on");
        fd.set("file", file);
        const res = await createResourceAction(fd);
        if (!res.ok) return setFormError(applyServerErrors(res, setError));
        toast(t.common.saved);
        reset({ ...v, title: "", description: "", file: undefined });
        router.refresh();
      })}
    >
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.common.title} htmlFor="r-title" error={err(formState.errors.title?.message)} className="sm:col-span-2">
          <input id="r-title" className="input" {...register("title", { required: "required", maxLength: { value: 160, message: "tooLong" } })} />
        </Field>
        <Field label={a.subject} htmlFor="r-subject">
          <select id="r-subject" className="input" {...register("subjectId")}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </Field>
        <Field label={a.resourceCourse} htmlFor="r-course" error={err(formState.errors.courseId?.message)}>
          <select id="r-course" className="input" {...register("courseId")}>
            <option value="">{a.noCourse}</option>
            {courses.filter((c) => c.subjectId === subjectId).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label={a.resourceType} htmlFor="r-type">
          <select id="r-type" className="input" {...register("type")}>
            {Object.entries(t.enums.resourceType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label={a.access} htmlFor="r-access"><AccessSelect id="r-access" register={register("accessLevel")} /></Field>
        <Field label={`${t.common.description} (${t.common.optional})`} htmlFor="r-desc" className="sm:col-span-2"><textarea id="r-desc" rows={2} className="input" {...register("description")} /></Field>
        <Field label={a.resourceFile} htmlFor="r-file" error={err(formState.errors.file?.message)} className="sm:col-span-2">
          <input id="r-file" type="file" accept="application/pdf,.pdf" className="input file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700" {...register("file")} />
        </Field>
      </div>
      {isAdmin && (
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded" {...register("publishNow")} /> {a.publish}</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded" {...register("isDemo")} /> {a.isDemo}</label>
        </div>
      )}
      <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? t.common.saving : a.newResource}</Button>
    </form>
  );
}

// ─────────── QCM ───────────
export function QuizForm({ subjects, quizId, defaults }: { subjects: Option[]; quizId?: string; defaults?: Partial<QuizInput> }) {
  const { t, err, toast, router, formError, setFormError } = useSubmitHelpers();
  const a = t.admin;
  const { register, handleSubmit, setError, formState } = useForm<QuizInput>({
    resolver: zodResolver(quizSchema, undefined, { raw: true }),
    defaultValues: { subjectId: subjects[0]?.id ?? "", title: "", description: "", accessLevel: "PREMIUM", passingScore: 50, timeLimitMinutes: "", isDemo: false, ...defaults },
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setFormError(undefined);
        const res = quizId ? await updateQuizAction(quizId, v) : await createQuizAction(v);
        if (!res.ok) return setFormError(applyServerErrors(res, setError));
        toast(t.common.saved);
        if (!quizId && res.data) router.push(`/admin/quizzes/${(res.data as { id: string }).id}`);
        else router.refresh();
      })}
    >
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={a.quizTitle} htmlFor="q-title" error={err(formState.errors.title?.message)} className="sm:col-span-2"><input id="q-title" className="input" {...register("title")} /></Field>
        <Field label={a.subject} htmlFor="q-subject"><select id="q-subject" className="input" {...register("subjectId")}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        <Field label={a.access} htmlFor="q-access"><AccessSelect id="q-access" register={register("accessLevel")} /></Field>
        <Field label={a.passingScore} htmlFor="q-pass" error={err(formState.errors.passingScore?.message)}><input id="q-pass" type="number" min={0} max={100} className="input" {...register("passingScore")} /></Field>
        <Field label={`${a.timeLimit} (${t.common.optional})`} htmlFor="q-time" error={err(formState.errors.timeLimitMinutes?.message)}><input id="q-time" type="number" min={1} className="input" {...register("timeLimitMinutes")} /></Field>
        <Field label={`${t.common.description} (${t.common.optional})`} htmlFor="q-desc" className="sm:col-span-2"><textarea id="q-desc" rows={2} className="input" {...register("description")} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded" {...register("isDemo")} /> {a.isDemo}</label>
      <Button type="submit" disabled={formState.isSubmitting}>{quizId ? t.common.save : t.common.create}</Button>
    </form>
  );
}

export function QuestionForm({ quizId, questionId, defaults, onDone }: { quizId: string; questionId?: string; defaults?: { prompt: string; type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE"; options: string[]; correct: number[]; explanation: string; points: number }; onDone?: () => void }) {
  const { t, err, toast, router, formError, setFormError } = useSubmitHelpers();
  const a = t.admin;
  const blank = ["", "", "", ""];
  const initialOptions = defaults ? [...defaults.options, ...blank].slice(0, Math.max(4, defaults.options.length)) : blank;
  const { register, handleSubmit, setError, reset, watch, setValue, formState } = useForm<QuestionInput>({
    resolver: zodResolver(questionSchema, undefined, { raw: true }),
    defaultValues: { prompt: defaults?.prompt ?? "", type: defaults?.type ?? "SINGLE_CHOICE", options: initialOptions, correct: defaults?.correct ?? [], explanation: defaults?.explanation ?? "", points: defaults?.points ?? 1 },
  });
  const type = watch("type");
  const correct = (watch("correct") ?? []).map(Number);
  const options = watch("options");

  function toggleCorrect(i: number) {
    if (type === "SINGLE_CHOICE") setValue("correct", [i]);
    else setValue("correct", correct.includes(i) ? correct.filter((x) => x !== i) : [...correct, i]);
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setFormError(undefined);
        const res = await saveQuestionAction(quizId, questionId ?? null, v);
        if (!res.ok) return setFormError(applyServerErrors(res, setError));
        toast(t.common.saved);
        if (!questionId) reset();
        onDone?.();
        router.refresh();
      })}
    >
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      <Field label={a.prompt} htmlFor={`qp-${questionId ?? "new"}`} error={err(formState.errors.prompt?.message)}><textarea id={`qp-${questionId ?? "new"}`} rows={2} className="input" {...register("prompt")} /></Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={a.resourceType} htmlFor={`qt-${questionId ?? "new"}`}>
          <select id={`qt-${questionId ?? "new"}`} className="input" {...register("type", { onChange: () => setValue("correct", []) })}>
            <option value="SINGLE_CHOICE">{t.enums.questionType.SINGLE_CHOICE}</option>
            <option value="MULTIPLE_CHOICE">{t.enums.questionType.MULTIPLE_CHOICE}</option>
          </select>
        </Field>
        <Field label={a.points} htmlFor={`qpt-${questionId ?? "new"}`}><input id={`qpt-${questionId ?? "new"}`} type="number" min={1} max={20} className="input" {...register("points")} /></Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">{a.options}</legend>
        {options.map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="input" placeholder={a.optionN.replace("{n}", String(i + 1))} {...register(`options.${i}` as const)} />
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-soft">
              <input type={type === "SINGLE_CHOICE" ? "radio" : "checkbox"} checked={correct.includes(i)} onChange={() => toggleCorrect(i)} className="h-4 w-4" /> {a.correct}
            </label>
          </div>
        ))}
        {options.length < 8 && <Button size="sm" variant="ghost" onClick={() => setValue("options", [...options, ""])}>+ {t.common.add}</Button>}
        {(formState.errors.options?.message || formState.errors.options?.root?.message) && <p className="text-xs text-red-600">{err(formState.errors.options?.message ?? formState.errors.options?.root?.message)}</p>}
        {formState.errors.correct && <p className="text-xs text-red-600">{err(formState.errors.correct.message ?? formState.errors.correct.root?.message)}</p>}
      </fieldset>
      <Field label={`${a.explanation} (${t.common.optional})`} htmlFor={`qe-${questionId ?? "new"}`}><textarea id={`qe-${questionId ?? "new"}`} rows={2} className="input" {...register("explanation")} /></Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={formState.isSubmitting}>{questionId ? t.common.save : a.newQuestion}</Button>
        {onDone && <Button variant="ghost" onClick={onDone}>{t.common.cancel}</Button>}
      </div>
    </form>
  );
}

export function EditQuestionToggle({ quizId, question, label }: { quizId: string; question: { id: string; prompt: string; type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE"; options: string[]; correct: number[]; explanation: string; points: number }; label: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <div className="mt-3 w-full rounded-xl border border-gray-100 bg-surface p-4">
      <QuestionForm quizId={quizId} questionId={question.id} defaults={question} onDone={() => setOpen(false)} />
    </div>
  );
}
