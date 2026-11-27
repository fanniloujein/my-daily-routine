"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { saveLevelAction, savePlanAction, saveSettingsAction, saveSubjectAction } from "@/actions/admin";
import { levelSchema, planSchema, settingsSchema, subjectSchema, type LevelInput, type PlanInput, type SettingsInput, type SubjectInput } from "@/lib/validation/admin";
import type { ActionResult } from "@/lib/action";
import { ICONS } from "@/components/icons";
import { Alert, Button, Field } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { applyServerErrors } from "./form";
import { useToast } from "./Toaster";

/** Formulaire générique : RHF + Zod + action serveur. */
function useActionForm<T extends FieldValues>(schema: z.ZodType, defaults: T, submit: (v: T) => Promise<ActionResult<unknown>>, opts?: { resetOnSuccess?: boolean; onDone?: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<T>({ resolver: zodResolver(schema as any, undefined, { raw: true }) as any, defaultValues: defaults as any });
  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(undefined);
    const res = await submit(v);
    if (!res.ok) return setFormError(applyServerErrors(res, form.setError));
    toast(t.common.saved);
    if (opts?.resetOnSuccess) form.reset(defaults);
    opts?.onDone?.();
    router.refresh();
  });
  return { form, onSubmit, formError };
}

function Wrap<T extends FieldValues>({ f, onSubmit, formError, children, label, onCancel }: { f: UseFormReturn<T>; onSubmit: () => void; formError?: string; children: React.ReactNode; label: string; onCancel?: () => void }) {
  const { t } = useI18n();
  const err = useErrorText();
  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      {children}
      <div className="flex gap-2">
        <Button type="submit" disabled={f.formState.isSubmitting}>{f.formState.isSubmitting ? t.common.saving : label}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>{t.common.cancel}</Button>}
      </div>
    </form>
  );
}

function errOf(f: UseFormReturn<FieldValues>, name: string) {
  return (f.formState.errors[name]?.message as string | undefined) ?? undefined;
}

// ─────────── Offres ───────────
export function PlanForm({ planId, defaults, levels, onCancel }: { planId?: string; defaults?: Partial<PlanInput>; levels: { id: string; label: string }[]; onCancel?: () => void }) {
  const { t } = useI18n();
  const err = useErrorText();
  const a = t.admin;
  const init: PlanInput = { code: "", name: "", nameAr: "", description: "", descriptionAr: "", price: "", durationDays: 30, features: "", featuresAr: "", levelId: "", isFeatured: false, isActive: true, order: 0, ...defaults };
  const { form: f, onSubmit, formError } = useActionForm<PlanInput>(planSchema, init, (v) => savePlanAction(planId ?? null, v), { resetOnSuccess: !planId, onDone: onCancel });
  const r = f.register;
  const e = (n: string) => err(errOf(f as unknown as UseFormReturn<FieldValues>, n));
  return (
    <Wrap f={f} onSubmit={onSubmit} formError={formError} label={planId ? t.common.save : a.newPlan} onCancel={onCancel}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={a.planCode} htmlFor={`pc-${planId}`} error={e("code")}><input id={`pc-${planId}`} dir="ltr" className="input uppercase" {...r("code")} /></Field>
        <Field label={a.planPrice} htmlFor={`pp-${planId}`} error={e("price")}><input id={`pp-${planId}`} inputMode="decimal" dir="ltr" className="input" {...r("price")} /></Field>
        <Field label={a.planDuration} htmlFor={`pd-${planId}`} error={e("durationDays")}><input id={`pd-${planId}`} type="number" className="input" {...r("durationDays")} /></Field>
        <Field label={a.planName} htmlFor={`pn-${planId}`} error={e("name")}><input id={`pn-${planId}`} className="input" {...r("name")} /></Field>
        <Field label={a.planNameAr} htmlFor={`pna-${planId}`}><input id={`pna-${planId}`} dir="rtl" className="input" {...r("nameAr")} /></Field>
        <Field label={a.planLevel} htmlFor={`pl-${planId}`}>
          <select id={`pl-${planId}`} className="input" {...r("levelId")}>
            <option value="">{a.allLevels}</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </Field>
        <Field label={a.planDescription} htmlFor={`pde-${planId}`} className="sm:col-span-3"><input id={`pde-${planId}`} className="input" {...r("description")} /></Field>
        <Field label={a.planDescriptionAr} htmlFor={`pdea-${planId}`} className="sm:col-span-3"><input id={`pdea-${planId}`} dir="rtl" className="input" {...r("descriptionAr")} /></Field>
        <Field label={a.planFeatures} htmlFor={`pf-${planId}`} className="sm:col-span-3 lg:col-span-1"><textarea id={`pf-${planId}`} rows={5} className="input" {...r("features")} /></Field>
        <Field label={a.planFeaturesAr} htmlFor={`pfa-${planId}`} className="sm:col-span-3 lg:col-span-1"><textarea id={`pfa-${planId}`} rows={5} dir="rtl" className="input" {...r("featuresAr")} /></Field>
        <Field label={t.common.order} htmlFor={`po-${planId}`}><input id={`po-${planId}`} type="number" className="input" {...r("order")} /></Field>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded" {...r("isActive")} /> {t.common.active}</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded" {...r("isFeatured")} /> {a.planFeatured}</label>
      </div>
    </Wrap>
  );
}

// ─────────── Niveaux & matières ───────────
export function LevelForm({ levelId, defaults, onCancel }: { levelId?: string; defaults?: Partial<LevelInput>; onCancel?: () => void }) {
  const { t } = useI18n();
  const err = useErrorText();
  const a = t.admin;
  const init: LevelInput = { name: "", nameAr: "", slug: "", description: "", category: "BACCALAUREATE", order: 0, ...defaults };
  const { form: f, onSubmit, formError } = useActionForm<LevelInput>(levelSchema, init, (v) => saveLevelAction(levelId ?? null, v), { resetOnSuccess: !levelId, onDone: onCancel });
  const r = f.register;
  const e = (n: string) => err(errOf(f as unknown as UseFormReturn<FieldValues>, n));
  return (
    <Wrap f={f} onSubmit={onSubmit} formError={formError} label={levelId ? t.common.save : a.newLevel} onCancel={onCancel}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={a.levelName} htmlFor={`ln-${levelId}`} error={e("name")}><input id={`ln-${levelId}`} className="input" {...r("name")} /></Field>
        <Field label={a.levelNameAr} htmlFor={`lna-${levelId}`}><input id={`lna-${levelId}`} dir="rtl" className="input" {...r("nameAr")} /></Field>
        <Field label={a.slug} htmlFor={`ls-${levelId}`} error={e("slug")}><input id={`ls-${levelId}`} dir="ltr" className="input" placeholder="bac-mathematiques" {...r("slug")} /></Field>
        <Field label={a.category} htmlFor={`lc-${levelId}`}>
          <select id={`lc-${levelId}`} className="input" {...r("category")}>{Object.entries(t.enums.levelCategory).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        <Field label={t.common.description} htmlFor={`ld-${levelId}`}><input id={`ld-${levelId}`} className="input" {...r("description")} /></Field>
        <Field label={t.common.order} htmlFor={`lo-${levelId}`}><input id={`lo-${levelId}`} type="number" className="input" {...r("order")} /></Field>
      </div>
    </Wrap>
  );
}

export function SubjectForm({ subjectId, levelId, defaults, onCancel }: { subjectId?: string; levelId: string; defaults?: Partial<SubjectInput>; onCancel?: () => void }) {
  const { t } = useI18n();
  const err = useErrorText();
  const a = t.admin;
  const init: SubjectInput = { levelId, name: "", nameAr: "", slug: "", icon: "book", description: "", order: 0, ...defaults };
  const { form: f, onSubmit, formError } = useActionForm<SubjectInput>(subjectSchema, init, (v) => saveSubjectAction(subjectId ?? null, v), { resetOnSuccess: !subjectId, onDone: onCancel });
  const r = f.register;
  const id = subjectId ?? `new-${levelId}`;
  const e = (n: string) => err(errOf(f as unknown as UseFormReturn<FieldValues>, n));
  return (
    <Wrap f={f} onSubmit={onSubmit} formError={formError} label={subjectId ? t.common.save : a.newSubject} onCancel={onCancel}>
      <input type="hidden" {...r("levelId")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <Field label={a.subjectName} htmlFor={`sn-${id}`} error={e("name")} className="sm:col-span-2"><input id={`sn-${id}`} className="input" {...r("name")} /></Field>
        <Field label={a.subjectNameAr} htmlFor={`sna-${id}`} className="sm:col-span-2"><input id={`sna-${id}`} dir="rtl" className="input" {...r("nameAr")} /></Field>
        <Field label={t.common.order} htmlFor={`so-${id}`}><input id={`so-${id}`} type="number" className="input" {...r("order")} /></Field>
        <Field label={a.slug} htmlFor={`ss-${id}`} error={e("slug")} className="sm:col-span-2"><input id={`ss-${id}`} dir="ltr" className="input" {...r("slug")} /></Field>
        <Field label={a.icon} htmlFor={`si-${id}`} className="sm:col-span-1">
          <select id={`si-${id}`} className="input" {...r("icon")}>{Object.keys(ICONS).map((k) => <option key={k} value={k}>{k}</option>)}</select>
        </Field>
        <Field label={t.common.description} htmlFor={`sd-${id}`} className="sm:col-span-2"><input id={`sd-${id}`} className="input" {...r("description")} /></Field>
      </div>
    </Wrap>
  );
}

function Toggle({ label, render }: { label: string; render: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{label}</Button>;
  return <div className="mt-3 w-full rounded-xl border border-gray-100 bg-surface p-4">{render(() => setOpen(false))}</div>;
}

export function EditPlanToggle(props: { label: string; planId: string; defaults: Partial<PlanInput>; levels: { id: string; label: string }[] }) {
  return <Toggle label={props.label} render={(close) => <PlanForm planId={props.planId} defaults={props.defaults} levels={props.levels} onCancel={close} />} />;
}

export function EditLevelToggle(props: { label: string; levelId: string; defaults: Partial<LevelInput> }) {
  return <Toggle label={props.label} render={(close) => <LevelForm levelId={props.levelId} defaults={props.defaults} onCancel={close} />} />;
}

export function EditSubjectToggle(props: { label: string; subjectId: string; levelId: string; defaults: Partial<SubjectInput> }) {
  return <Toggle label={props.label} render={(close) => <SubjectForm subjectId={props.subjectId} levelId={props.levelId} defaults={props.defaults} onCancel={close} />} />;
}

// ─────────── Paramètres ───────────
export function SettingsForm({ defaults }: { defaults: SettingsInput }) {
  const { t } = useI18n();
  const err = useErrorText();
  const a = t.admin;
  const { form: f, onSubmit, formError } = useActionForm<SettingsInput>(settingsSchema, defaults, (v) => saveSettingsAction(v));
  const r = f.register;
  const e = (n: string) => err(errOf(f as unknown as UseFormReturn<FieldValues>, n));
  return (
    <Wrap f={f} onSubmit={onSubmit} formError={formError} label={t.common.save}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={a.contactEmail} htmlFor="se" error={e("contactEmail")}><input id="se" dir="ltr" className="input" {...r("contactEmail")} /></Field>
        <Field label={a.contactPhone} htmlFor="sp"><input id="sp" dir="ltr" className="input" {...r("contactPhone")} /></Field>
        <Field label={a.paymentInstructions} htmlFor="spi" hint={a.paymentInstructionsHint} error={e("paymentInstructions")}><textarea id="spi" rows={5} className="input" {...r("paymentInstructions")} /></Field>
        <Field label={a.paymentInstructionsAr} htmlFor="spia" error={e("paymentInstructionsAr")}><textarea id="spia" rows={5} dir="rtl" className="input" {...r("paymentInstructionsAr")} /></Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{a.enabledMethods}</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {(["BANK_TRANSFER", "POSTAL_TRANSFER", "MOBILE_WALLET", "CASH"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2"><input type="checkbox" value={m} className="h-4 w-4 rounded" {...r("enabledPaymentMethods")} /> {t.enums.paymentMethod[m]}</label>
          ))}
        </div>
        {e("enabledPaymentMethods") && <p className="mt-1 text-xs text-red-600">{e("enabledPaymentMethods")}</p>}
      </fieldset>
    </Wrap>
  );
}
