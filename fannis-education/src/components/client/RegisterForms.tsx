"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerStudentAction, registerTeacherAction } from "@/actions/auth";
import {
  studentRegisterSchema,
  teacherRegisterSchema,
  type StudentRegisterInput,
  type TeacherRegisterInput,
} from "@/lib/validation/auth";
import { Alert, Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { applyServerErrors } from "./form";

type Option = { id: string; label: string };

function AccountFields({ register, errors }: { register: ReturnType<typeof useForm<StudentRegisterInput>>["register"]; errors: Record<string, { message?: string } | undefined> }) {
  const { t } = useI18n();
  const err = useErrorText();
  return (
    <>
      <Field label={t.auth.name} htmlFor="name" error={err(errors.name?.message)}>
        <input id="name" autoComplete="name" className="input" {...register("name")} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.auth.email} htmlFor="email" error={err(errors.email?.message)}>
          <input id="email" type="email" autoComplete="email" dir="ltr" className="input" {...register("email")} />
        </Field>
        <Field label={`${t.auth.phone} (${t.common.optional})`} htmlFor="phone" error={err(errors.phone?.message)}>
          <input id="phone" type="tel" autoComplete="tel" dir="ltr" className="input" placeholder="22 123 456" {...register("phone")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.auth.password} htmlFor="password" error={err(errors.password?.message)} hint={t.auth.passwordHint}>
          <input id="password" type="password" autoComplete="new-password" dir="ltr" className="input" {...register("password")} />
        </Field>
        <Field label={t.auth.confirmPassword} htmlFor="confirmPassword" error={err(errors.confirmPassword?.message)}>
          <input id="confirmPassword" type="password" autoComplete="new-password" dir="ltr" className="input" {...register("confirmPassword")} />
        </Field>
      </div>
    </>
  );
}

function Terms({ register, error }: { register: ReturnType<typeof useForm<StudentRegisterInput>>["register"]; error?: string }) {
  const { t } = useI18n();
  const err = useErrorText();
  return (
    <div>
      <label className="flex items-start gap-2.5 text-sm text-ink-soft">
        <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600" {...register("acceptTerms")} />
        {t.auth.acceptTerms}
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{err(error)}</p>}
    </div>
  );
}

export function StudentRegisterForm({ levels }: { levels: Option[] }) {
  const { t } = useI18n();
  const err = useErrorText();
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const form = useForm<StudentRegisterInput>({
    resolver: zodResolver(studentRegisterSchema, undefined, { raw: true }),
    defaultValues: { levelId: levels.length === 1 ? levels[0].id : "", acceptTerms: false as unknown as true },
  });
  const { register, handleSubmit, setError, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    const res = await registerStudentAction(values);
    if (res.ok && res.data) {
      router.replace(res.data.redirect);
      router.refresh();
      return;
    }
    setFormError(applyServerErrors(res, setError));
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      <AccountFields register={register} errors={formState.errors} />
      <Field label={t.auth.level} htmlFor="levelId" error={err(formState.errors.levelId?.message)}>
        <select id="levelId" className="input" {...register("levelId")}>
          <option value="">{t.auth.chooseLevel}</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </Field>
      <Terms register={register} error={formState.errors.acceptTerms?.message} />
      <Button type="submit" size="lg" className="w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? t.common.loading : t.auth.submitRegister}
      </Button>
    </form>
  );
}

export function TeacherRegisterForm({ subjectGroups }: { subjectGroups: { level: string; subjects: Option[] }[] }) {
  const { t } = useI18n();
  const err = useErrorText();
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const form = useForm<TeacherRegisterInput>({
    resolver: zodResolver(teacherRegisterSchema, undefined, { raw: true }),
    defaultValues: { subjectIds: [], acceptTerms: false as unknown as true },
  });
  const { register, handleSubmit, setError, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    const res = await registerTeacherAction(values);
    if (res.ok && res.data) {
      router.replace(res.data.redirect);
      router.refresh();
      return;
    }
    setFormError(applyServerErrors(res, setError));
  });

  const reg = register as unknown as ReturnType<typeof useForm<StudentRegisterInput>>["register"];
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      <AccountFields register={reg} errors={formState.errors} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.auth.city} htmlFor="city" error={err(formState.errors.city?.message)}>
          <input id="city" className="input" {...register("city")} />
        </Field>
        <Field label={t.auth.headline} htmlFor="headline" error={err(formState.errors.headline?.message)}>
          <input id="headline" className="input" placeholder={t.auth.headlinePlaceholder} {...register("headline")} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t.auth.subjectsTaught}</legend>
        {subjectGroups.map((g) => (
          <div key={g.level} className="mb-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">{g.level}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {g.subjects.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50">
                  <input type="checkbox" value={s.id} className="h-4 w-4 rounded border-gray-300 text-brand-600" {...register("subjectIds")} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        {formState.errors.subjectIds && <p className="text-xs text-red-600">{err(formState.errors.subjectIds.message ?? formState.errors.subjectIds.root?.message)}</p>}
      </fieldset>
      <Terms register={reg} error={formState.errors.acceptTerms?.message} />
      <Button type="submit" size="lg" className="w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? t.common.loading : t.auth.submitRegister}
      </Button>
    </form>
  );
}
