"use client";

import { Check, HelpCircle, Info } from "lucide-react";
import type { Dict } from "@/i18n";
import { UNSURE, pick, type AnswerValue, type Locale, type Question } from "@/lib/services/types";
import { asArray, type FieldError } from "@/lib/services/logic";

interface Props {
  q: Question;
  idPrefix: string;
  value: AnswerValue | undefined;
  error?: FieldError;
  locale: Locale;
  d: Dict;
  onChange: (v: AnswerValue | undefined) => void;
}

const INPUT_TYPES: Record<string, string> = { text: "text", email: "email", url: "url", tel: "tel" };
const AUTOCOMPLETE: Record<string, string> = { email: "email", tel: "tel", url: "url" };

export function QuestionField({ q, idPrefix, value, error, locale, d, onChange }: Props) {
  const id = `${idPrefix}-${q.id}`;
  const helpId = q.help ? `${id}-help` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [helpId, errId].filter(Boolean).join(" ") || undefined;
  const label = pick(q.label, locale);
  const unsureLabel = d.common.unsure;

  if (q.type === "note") {
    return (
      <p className="flex items-start gap-3 rounded-xl bg-cyan-soft px-4 py-3 text-sm text-midnight">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-deep" aria-hidden="true" />
        {label}
      </p>
    );
  }

  const Required = q.required ? (
    <>
      <span className="text-danger" aria-hidden="true"> *</span>
    </>
  ) : null;

  const Help = q.help ? (
    <p id={helpId} className="field-help">
      {pick(q.help, locale)}
    </p>
  ) : null;
  const Err = error ? (
    <p id={errId} className="field-error" role="alert">
      {d.configurator.errors[error]}
    </p>
  ) : null;

  if (q.type === "single" || q.type === "multi") {
    const multi = q.type === "multi";
    const current = asArray(value);
    const options = [...(q.options ?? []).map((o) => ({ value: o.value, label: pick(o.label, locale) }))];
    const toggle = (v: string) => {
      if (!multi) return onChange(current[0] === v ? undefined : v);
      if (v === UNSURE) return onChange(current.includes(UNSURE) ? undefined : [UNSURE]);
      const next = current.filter((x) => x !== UNSURE);
      const out = next.includes(v) ? next.filter((x) => x !== v) : [...next, v];
      onChange(out.length ? out : undefined);
    };
    return (
      <fieldset aria-describedby={describedBy} aria-invalid={Boolean(error)} aria-required={q.required}>
        <legend className="field-label">
          {label}
          {Required}
        </legend>
        {Help}
        <div className={`mt-3 grid gap-2.5 ${options.length > 4 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
          {options.map((o) => {
            const on = current.includes(o.value);
            return (
              <label
                key={o.value}
                className={`relative flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm transition focus-within:ring-2 focus-within:ring-cyan ${
                  on ? "border-midnight bg-midnight text-white shadow-card" : "border-line bg-white text-ink hover:border-ink/30"
                }`}
              >
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={id}
                  value={o.value}
                  checked={on}
                  onChange={() => toggle(o.value)}
                  onClick={(e) => {
                    // Un second clic sur une option radio déjà choisie la désélectionne.
                    if (!multi && on) {
                      e.preventDefault();
                      toggle(o.value);
                    }
                  }}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center border ${multi ? "rounded-md" : "rounded-full"} ${
                    on ? "border-gold bg-gold text-midnight" : "border-ink/25 bg-white"
                  }`}
                >
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="font-medium leading-snug">{o.label}</span>
              </label>
            );
          })}
        </div>
        {q.unsure && (
          <label className={`mt-2.5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed px-3.5 py-2 text-sm transition focus-within:ring-2 focus-within:ring-cyan ${
            current.includes(UNSURE) ? "border-cyan-deep bg-cyan-soft text-midnight" : "border-ink/25 text-ink-2 hover:border-ink/40"
          }`}>
            <input
              type={multi ? "checkbox" : "radio"}
              name={id}
              value={UNSURE}
              checked={current.includes(UNSURE)}
              onChange={() => toggle(UNSURE)}
              onClick={(e) => {
                if (!multi && current.includes(UNSURE)) {
                  e.preventDefault();
                  toggle(UNSURE);
                }
              }}
              className="sr-only"
            />
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            {unsureLabel}
          </label>
        )}
        {Err}
      </fieldset>
    );
  }

  if (q.type === "select") {
    const v = typeof value === "string" ? value : "";
    return (
      <div>
        <label htmlFor={id} className="field-label">
          {label}
          {Required}
        </label>
        <select
          id={id}
          className="input"
          value={v}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          aria-required={q.required}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">{d.common.choose}</option>
          {(q.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {pick(o.label, locale)}
            </option>
          ))}
          {q.unsure && <option value={UNSURE}>{unsureLabel}</option>}
        </select>
        {Help}
        {Err}
      </div>
    );
  }

  // Champs texte
  const isUnsure = value === UNSURE;
  const text = typeof value === "string" && !isUnsure ? value : "";
  const common = {
    id,
    className: "input",
    value: text,
    disabled: isUnsure,
    maxLength: q.maxLength ?? 500,
    placeholder: q.placeholder ? pick(q.placeholder, locale) : undefined,
    "aria-describedby": describedBy,
    "aria-invalid": Boolean(error),
    "aria-required": q.required,
  };
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {Required}
      </label>
      {q.type === "textarea" ? (
        <textarea {...common} rows={4} onChange={(e) => onChange(e.target.value || undefined)} />
      ) : (
        <input
          {...common}
          type={INPUT_TYPES[q.type] ?? "text"}
          dir={q.type === "email" || q.type === "url" || q.type === "tel" ? "ltr" : undefined}
          autoComplete={AUTOCOMPLETE[q.type] ?? "off"}
          inputMode={q.type === "tel" ? "tel" : q.type === "email" ? "email" : q.type === "url" ? "url" : undefined}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      )}
      {q.unsure && (
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink/30 accent-midnight"
            checked={isUnsure}
            onChange={(e) => onChange(e.target.checked ? UNSURE : undefined)}
          />
          {unsureLabel}
        </label>
      )}
      {Help}
      {Err}
    </div>
  );
}
