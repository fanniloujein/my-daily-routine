"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { contactAction } from "@/actions/public";
import { Alert, Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";

type Values = { name: string; email: string; message: string; website?: string };

export function ContactForm() {
  const { t } = useI18n();
  const err = useErrorText();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, setError, reset, formState } = useForm<Values>();

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    const res = await contactAction(values);
    if (res.ok) {
      setSent(true);
      reset();
      return;
    }
    for (const [k, v] of Object.entries(res.fieldErrors ?? {})) setError(k as keyof Values, { message: v });
    setFormError(res.error);
  });

  if (sent) return <Alert tone="green" title={t.landing.contactSent} />;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError && formError !== "validation" && <Alert tone="red">{err(formError)}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.landing.contactName} htmlFor="c-name" error={err(formState.errors.name?.message)}>
          <input id="c-name" className="input" autoComplete="name" {...register("name", { required: "required", maxLength: { value: 100, message: "tooLong" } })} />
        </Field>
        <Field label={t.landing.contactEmail} htmlFor="c-email" error={err(formState.errors.email?.message)}>
          <input id="c-email" type="email" className="input" autoComplete="email" dir="ltr" {...register("email", { required: "required", pattern: { value: /^\S+@\S+\.\S+$/, message: "invalidEmail" } })} />
        </Field>
      </div>
      <Field label={t.landing.contactMessage} htmlFor="c-msg" error={err(formState.errors.message?.message)}>
        <textarea id="c-msg" rows={4} className="input" {...register("message", { required: "required", maxLength: { value: 3000, message: "tooLong" } })} />
      </Field>
      <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden {...register("website")} />
      <Button type="submit" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? t.common.loading : t.landing.contactSend}
      </Button>
    </form>
  );
}
