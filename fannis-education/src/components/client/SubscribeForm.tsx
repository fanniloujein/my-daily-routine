"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { requestSubscriptionAction } from "@/actions/student";
import { subscriptionRequestSchema, type SubscriptionRequestInput } from "@/lib/validation/student";
import { Alert, Button, Field } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { fmt } from "@/lib/i18n/config";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { applyServerErrors } from "./form";

type Plan = { id: string; name: string; description: string | null; price: string; days: number; features: string[]; featured: boolean };

export function SubscribeForm({ plans, methods, instructions }: { plans: Plan[]; methods: SubscriptionRequestInput["method"][]; instructions: string }) {
  const { t } = useI18n();
  const err = useErrorText();
  const router = useRouter();
  const s = t.student;
  const [formError, setFormError] = useState<string>();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, setError, watch, formState } = useForm<SubscriptionRequestInput>({
    resolver: zodResolver(subscriptionRequestSchema, undefined, { raw: true }),
    defaultValues: { planId: plans.find((p) => p.featured)?.id ?? plans[0]?.id, method: methods[0], reference: "" },
  });
  const planId = watch("planId");
  const plan = plans.find((p) => p.id === planId);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    const res = await requestSubscriptionAction(values);
    if (res.ok) {
      setDone(true);
      router.refresh();
      return;
    }
    setFormError(applyServerErrors(res, setError));
  });

  if (done) return <Alert tone="green" title={s.subSubmitted} />;

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <fieldset>
        <legend className="mb-3 font-semibold">{s.subPlans}</legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <label key={p.id} className={cn("flex cursor-pointer flex-col rounded-2xl border-2 bg-white p-5 transition", planId === p.id ? "border-brand-400 shadow-card" : "border-gray-100 hover:border-brand-200")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  {p.description && <p className="mt-0.5 text-sm text-ink-muted">{p.description}</p>}
                </div>
                <input type="radio" value={p.id} className="mt-1 h-4 w-4 text-brand-600" {...register("planId")} />
              </div>
              <p className="mt-4 text-3xl font-bold">{p.price}</p>
              <p className="text-sm text-ink-muted">{fmt(s.subDuration, { days: p.days })}</p>
              <ul className="mt-4 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink-soft"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden /> {f}</li>
                ))}
              </ul>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card sm:p-6">
        <h3 className="font-semibold">{s.subPayTitle}</h3>
        {plan && <p className="mt-1 text-sm text-ink-soft">{fmt(s.subPayIntro, { amount: plan.price })}</p>}
        <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm">
          <p className="font-medium">{s.subInstructions}</p>
          <p className="mt-1 whitespace-pre-line text-ink-soft">{instructions}</p>
        </div>
        {formError && <Alert tone="red" className="mt-4">{err(formError)}</Alert>}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={s.subMethod} htmlFor="method" error={err(formState.errors.method?.message)}>
            <select id="method" className="input" {...register("method")}>
              {methods.map((m) => <option key={m} value={m}>{t.enums.paymentMethod[m]}</option>)}
            </select>
          </Field>
          <Field label={s.subReference} htmlFor="reference" error={err(formState.errors.reference?.message)} hint={s.subReferenceHint}>
            <input id="reference" className="input" dir="ltr" {...register("reference")} />
          </Field>
        </div>
        <Field label={`${s.subPayerNote} (${t.common.optional})`} htmlFor="payerNote" className="mt-4" error={err(formState.errors.payerNote?.message)}>
          <textarea id="payerNote" rows={2} className="input" {...register("payerNote")} />
        </Field>
        <p className="mt-4 text-xs text-ink-muted">{s.subNoManualPayment}</p>
        <Button type="submit" className="mt-4" disabled={formState.isSubmitting || !plan}>
          {formState.isSubmitting ? t.common.loading : s.subSubmit}
        </Button>
      </div>
    </form>
  );
}
