"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { saveAvailabilityAction, updateTeacherProfileAction } from "@/actions/teacher";
import { availabilitySchema, teacherProfileSchema, type AvailabilityInput, type TeacherProfileInput } from "@/lib/validation/teacher";
import { Alert, Button, EmptyState, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { applyServerErrors } from "./form";
import { useToast } from "./Toaster";

export function TeacherProfileForm({ defaults, subjectGroups }: { defaults: TeacherProfileInput; subjectGroups: { level: string; subjects: { id: string; label: string }[] }[] }) {
  const { t } = useI18n();
  const err = useErrorText();
  const toast = useToast();
  const router = useRouter();
  const tt = t.teacher;
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, setError, control, formState } = useForm<TeacherProfileInput>({
    resolver: zodResolver(teacherProfileSchema, undefined, { raw: true }),
    defaultValues: defaults,
  });
  const online = useWatch({ control, name: "offersOnline" });
  const inPerson = useWatch({ control, name: "offersInPerson" });
  const e = formState.errors;

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={handleSubmit(async (v) => {
        setFormError(undefined);
        const res = await updateTeacherProfileAction(v);
        if (res.ok) {
          toast(t.common.saved);
          router.refresh();
        } else setFormError(applyServerErrors(res, setError));
      })}
    >
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={tt.headline} htmlFor="headline" error={err(e.headline?.message)} className="sm:col-span-2"><input id="headline" className="input" placeholder={t.auth.headlinePlaceholder} {...register("headline")} /></Field>
        <Field label={tt.bio} htmlFor="bio" error={err(e.bio?.message)} className="sm:col-span-2"><textarea id="bio" rows={5} className="input" placeholder={tt.bioPlaceholder} {...register("bio")} /></Field>
        <Field label={t.common.city} htmlFor="city" error={err(e.city?.message)}><input id="city" className="input" {...register("city")} /></Field>
        <Field label={tt.yearsExperience} htmlFor="years" error={err(e.yearsExperience?.message)}><input id="years" type="number" min={0} max={60} className="input" {...register("yearsExperience")} /></Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{tt.subjects}</legend>
        {subjectGroups.map((g) => (
          <div key={g.level} className="mb-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">{g.level}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {g.subjects.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50">
                  <input type="checkbox" value={s.id} className="h-4 w-4 rounded" {...register("subjectIds")} /> {s.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        {e.subjectIds && <p className="text-xs text-red-600">{err(e.subjectIds.message ?? e.subjectIds.root?.message)}</p>}
      </fieldset>

      <fieldset className="space-y-4 rounded-2xl bg-surface p-4">
        <legend className="sr-only">{tt.modesTitle}</legend>
        <p className="text-sm font-semibold">{tt.modesTitle}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded" {...register("offersOnline")} /> {tt.offersOnline}</label>
            {online && <Field label={tt.onlinePrice} htmlFor="onlinePrice" error={err(e.onlinePrice?.message)}><input id="onlinePrice" inputMode="decimal" dir="ltr" className="input" {...register("onlinePrice")} /></Field>}
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded" {...register("offersInPerson")} /> {tt.offersInPerson}</label>
            {inPerson && (
              <>
                <Field label={tt.inPersonPrice} htmlFor="inPersonPrice" error={err(e.inPersonPrice?.message)}><input id="inPersonPrice" inputMode="decimal" dir="ltr" className="input" {...register("inPersonPrice")} /></Field>
                <Field label={tt.inPersonArea} htmlFor="inPersonArea" error={err(e.inPersonArea?.message)}><input id="inPersonArea" className="input" {...register("inPersonArea")} /></Field>
              </>
            )}
          </div>
        </div>
        {e.offersOnline && <p className="text-xs text-red-600">{err(e.offersOnline.message)}</p>}
        <Field label={tt.lessonDuration} htmlFor="duration" error={err(e.lessonDurationMinutes?.message)} className="max-w-xs">
          <select id="duration" className="input" {...register("lessonDurationMinutes")}>
            {[30, 45, 60, 75, 90, 120].map((m) => <option key={m} value={m}>{m} {t.common.minutes}</option>)}
          </select>
        </Field>
      </fieldset>

      <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? t.common.saving : t.common.save}</Button>
    </form>
  );
}

export function AvailabilityEditor({ defaults }: { defaults: AvailabilityInput["slots"] }) {
  const { t } = useI18n();
  const err = useErrorText();
  const toast = useToast();
  const router = useRouter();
  const tt = t.teacher;
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, control, setError, formState } = useForm<AvailabilityInput>({
    resolver: zodResolver(availabilitySchema, undefined, { raw: true }),
    defaultValues: { slots: defaults },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "slots" });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setFormError(undefined);
        const res = await saveAvailabilityAction(v);
        if (res.ok) {
          toast(t.common.saved);
          router.refresh();
        } else setFormError(applyServerErrors(res, setError));
      })}
    >
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      {fields.length === 0 && <EmptyState title={tt.availabilityEmpty} />}
      <ul className="space-y-3">
        {fields.map((f, i) => {
          const fe = formState.errors.slots?.[i];
          return (
            <li key={f.id} className="grid grid-cols-2 items-end gap-3 rounded-xl border border-gray-100 bg-white p-3 sm:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto]">
              <Field label={tt.day} htmlFor={`d-${i}`}>
                <select id={`d-${i}`} className="input" {...register(`slots.${i}.dayOfWeek` as const)}>
                  {t.enums.days.map((d, k) => <option key={k} value={k}>{d}</option>)}
                </select>
              </Field>
              <Field label={tt.start} htmlFor={`s-${i}`} error={err(fe?.start?.message)}><input id={`s-${i}`} type="time" step={900} className="input" {...register(`slots.${i}.start` as const)} /></Field>
              <Field label={tt.end} htmlFor={`e-${i}`} error={err(fe?.end?.message)}><input id={`e-${i}`} type="time" step={900} className="input" {...register(`slots.${i}.end` as const)} /></Field>
              <Field label={tt.mode} htmlFor={`m-${i}`}>
                <select id={`m-${i}`} className="input" {...register(`slots.${i}.mode` as const)}>
                  <option value="BOTH">{tt.bothModes}</option>
                  <option value="ONLINE">{t.enums.lessonMode.ONLINE}</option>
                  <option value="IN_PERSON">{t.enums.lessonMode.IN_PERSON}</option>
                </select>
              </Field>
              <Button variant="ghost" onClick={() => remove(i)} aria-label={t.common.delete}><Trash2 className="h-4 w-4" /></Button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => append({ dayOfWeek: 1, start: "17:00", end: "20:00", mode: "BOTH" })}><Plus className="h-4 w-4" /> {tt.addSlot}</Button>
        <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? t.common.saving : t.common.save}</Button>
      </div>
    </form>
  );
}
