"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordAction } from "@/actions/auth";
import { updateStudentProfileAction } from "@/actions/student";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/auth";
import { studentProfileSchema, type StudentProfileInput } from "@/lib/validation/student";
import { Alert, Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { applyServerErrors } from "./form";
import { useToast } from "./Toaster";

export function StudentProfileForm({ defaults, levels }: { defaults: StudentProfileInput; levels: { id: string; label: string }[] }) {
  const { t } = useI18n();
  const err = useErrorText();
  const toast = useToast();
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, setError, formState } = useForm<StudentProfileInput>({
    resolver: zodResolver(studentProfileSchema, undefined, { raw: true }),
    defaultValues: defaults,
  });
  const s = t.student;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setFormError(undefined);
        const res = await updateStudentProfileAction(v);
        if (res.ok) {
          toast(t.common.saved);
          router.refresh();
        } else setFormError(applyServerErrors(res, setError));
      })}
    >
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.auth.name} htmlFor="name" error={err(formState.errors.name?.message)}><input id="name" className="input" {...register("name")} /></Field>
        <Field label={t.auth.level} htmlFor="levelId" error={err(formState.errors.levelId?.message)}>
          <select id="levelId" className="input" {...register("levelId")}>
            <option value="">{t.auth.chooseLevel}</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </Field>
        <Field label={`${t.auth.phone} (${t.common.optional})`} htmlFor="phone" error={err(formState.errors.phone?.message)}><input id="phone" dir="ltr" className="input" {...register("phone")} /></Field>
        <Field label={`${s.profileGuardianPhone} (${t.common.optional})`} htmlFor="guardianPhone" error={err(formState.errors.guardianPhone?.message)}><input id="guardianPhone" dir="ltr" className="input" {...register("guardianPhone")} /></Field>
        <Field label={`${t.common.city} (${t.common.optional})`} htmlFor="city"><input id="city" className="input" {...register("city")} /></Field>
        <Field label={`${s.profileSchool} (${t.common.optional})`} htmlFor="school"><input id="school" className="input" {...register("school")} /></Field>
      </div>
      <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? t.common.saving : t.common.save}</Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const { t } = useI18n();
  const err = useErrorText();
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, setError, formState } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema, undefined, { raw: true }),
  });
  const s = t.student;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setFormError(undefined);
        const res = await changePasswordAction(v);
        if (res.ok) {
          window.alert(s.profilePasswordChanged);
          router.replace("/login");
        } else setFormError(applyServerErrors(res, setError));
      })}
    >
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      <Field label={s.profileCurrentPassword} htmlFor="currentPassword" error={err(formState.errors.currentPassword?.message)}>
        <input id="currentPassword" type="password" autoComplete="current-password" dir="ltr" className="input" {...register("currentPassword")} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={s.profileNewPassword} htmlFor="newPassword" error={err(formState.errors.newPassword?.message)} hint={t.auth.passwordHint}>
          <input id="newPassword" type="password" autoComplete="new-password" dir="ltr" className="input" {...register("newPassword")} />
        </Field>
        <Field label={t.auth.confirmPassword} htmlFor="confirmPassword" error={err(formState.errors.confirmPassword?.message)}>
          <input id="confirmPassword" type="password" autoComplete="new-password" dir="ltr" className="input" {...register("confirmPassword")} />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={formState.isSubmitting}>{s.profilePassword}</Button>
    </form>
  );
}
