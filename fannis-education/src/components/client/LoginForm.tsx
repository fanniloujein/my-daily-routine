"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginAction } from "@/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { Alert, Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { applyServerErrors } from "./form";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const err = useErrorText();
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, setError, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema, undefined, { raw: true }),
    defaultValues: { email: "", password: "", next },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    const res = await loginAction(values);
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
      <Field label={t.auth.email} htmlFor="email" error={err(formState.errors.email?.message)}>
        <input id="email" type="email" autoComplete="email" dir="ltr" className="input" {...register("email")} />
      </Field>
      <Field label={t.auth.password} htmlFor="password" error={err(formState.errors.password?.message)}>
        <input id="password" type="password" autoComplete="current-password" dir="ltr" className="input" {...register("password")} />
      </Field>
      <Button type="submit" className="w-full" size="lg" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? t.common.loading : t.auth.submitLogin}
      </Button>
    </form>
  );
}
