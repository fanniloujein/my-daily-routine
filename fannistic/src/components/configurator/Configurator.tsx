"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Pencil,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { ServiceIcon } from "@/components/site/ServiceIcon";
import { QuestionField } from "./QuestionField";
import { fmt, formatMoney, formatSize, type Dict, type Locale } from "@/i18n";
import { UNSURE, pick, type AnswerValue, type Answers, type ServiceAnswers, type ServiceDef } from "@/lib/services/types";
import { computeEstimate, validateServiceAnswers, visibleQuestions, type FieldError, type PricingSettings } from "@/lib/services/logic";
import { describeAnswers, type SnapshotValue } from "@/lib/services/describe";
import { BUDGETS, CONTACT_PREFS, DEADLINES, contactSchema, phoneRequired } from "@/lib/services/project";

const STORAGE_KEY = "fannistic.configurator.v1";
const MAX_FILES = 5;
const MAX_MB = 10;
const ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.pdf,.ai,.docx,.xlsx,.pptx,.zip,.txt";
const ACCEPT_EXT = new Set(ACCEPT.split(",").map((e) => e.slice(1)));

interface Contact {
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  contactPref: string;
  comments: string;
}

interface Project {
  budget?: string;
  deadline?: string;
  details?: string;
}

interface State {
  step: string;
  services: string[];
  answers: Answers;
  project: Project;
  contact: Contact;
  kind: "QUOTE" | "CALL";
  consent: boolean;
  startedAt: number;
}

type Errors = Record<string, FieldError | "consent">;

const emptyContact: Contact = { name: "", email: "", phone: "", company: "", country: "", contactPref: "email", comments: "" };

const freshState = (): State => ({
  step: "services",
  services: [],
  answers: {},
  project: {},
  contact: emptyContact,
  kind: "QUOTE",
  consent: false,
  startedAt: Date.now(),
});

interface Done {
  reference: string;
  url: string;
  emailSent: boolean;
  kind: "QUOTE" | "CALL";
  name: string;
  email: string;
}

export function Configurator({
  locale,
  d,
  services,
  pricing,
  initialService,
  loggedIn,
}: {
  locale: Locale;
  d: Dict;
  services: ServiceDef[];
  pricing: PricingSettings;
  initialService?: string;
  loggedIn: boolean;
}) {
  const c = d.configurator;
  const [state, setState] = useState<State>(freshState);
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Chargement du brouillon enregistré sur l'appareil.
  useEffect(() => {
    let s = freshState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) s = { ...s, ...(JSON.parse(raw) as Partial<State>), consent: false };
    } catch {
      /* stockage indisponible : on repart de zéro */
    }
    s.services = s.services.filter((slug) => services.some((x) => x.slug === slug));
    if (initialService && services.some((x) => x.slug === initialService) && !s.services.includes(initialService)) {
      s.services = [...s.services, initialService];
    }
    setState(s);
    setReady(true);
  }, [initialService, services]);

  useEffect(() => {
    if (!ready || done) return;
    try {
      const { consent: _consent, ...rest } = state;
      void _consent;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    } catch {
      /* stockage indisponible (navigation privée…) : le parcours fonctionne sans brouillon */
    }
  }, [state, ready, done]);

  const selectedDefs = useMemo(
    () => services.filter((s) => state.services.includes(s.slug)),
    [services, state.services],
  );

  const steps = useMemo(
    () => ["services", ...selectedDefs.map((s) => `svc:${s.slug}`), "project", "contact", "summary"],
    [selectedDefs],
  );
  const stepIndex = Math.max(0, steps.indexOf(state.step));
  const step = steps[stepIndex];

  // Focus sur le titre à chaque changement d'étape (lecteurs d'écran et clavier).
  useEffect(() => {
    if (!ready) return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, ready, done]);

  const estimate = useMemo(
    () => computeEstimate(services, state.services, state.answers, state.project.deadline, pricing),
    [services, state.services, state.answers, state.project.deadline, pricing],
  );

  const stepLabel = (id: string) => {
    if (id.startsWith("svc:")) return pick(services.find((s) => `svc:${s.slug}` === id)?.name, locale);
    return c.steps[id as keyof typeof c.steps];
  };

  const go = (id: string) => {
    setErrors({});
    setSubmitError(null);
    setState((s) => ({ ...s, step: id }));
  };

  const update = (patch: Partial<State>) => setState((s) => ({ ...s, ...patch }));

  const setAnswer = (slug: string, qid: string, v: AnswerValue | undefined) => {
    setState((s) => {
      const current: ServiceAnswers = { ...(s.answers[slug] ?? {}) };
      if (v === undefined) delete current[qid];
      else current[qid] = v;
      return { ...s, answers: { ...s.answers, [slug]: current } };
    });
    setErrors((e) => {
      if (!e[qid]) return e;
      const { [qid]: _removed, ...rest } = e;
      void _removed;
      return rest;
    });
  };

  const toggleService = (slug: string) => {
    setErrors({});
    setState((s) => ({
      ...s,
      services: s.services.includes(slug) ? s.services.filter((x) => x !== slug) : [...s.services, slug],
    }));
  };

  const validateStep = useCallback(
    (id: string): Errors => {
      if (id === "services") return state.services.length ? {} : { services: "required" };
      if (id.startsWith("svc:")) {
        const def = services.find((s) => `svc:${s.slug}` === id);
        if (!def) return {};
        return validateServiceAnswers(def, state.answers[def.slug]).errors;
      }
      if (id === "contact") {
        const r = contactSchema.safeParse(state.contact);
        const errs: Errors = {};
        if (!r.success) {
          for (const issue of r.error.issues) {
            const key = String(issue.path[0]);
            if (!errs[key]) errs[key] = (issue.message as FieldError) || "invalid";
          }
        }
        if (phoneRequired(state.contact.contactPref) && !state.contact.phone.trim()) errs.phone = "required";
        return errs;
      }
      if (id === "summary") return state.consent ? {} : { consent: "consent" };
      return {};
    },
    [services, state],
  );

  const focusFirstError = () => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>("[aria-invalid='true'],[data-invalid='true']");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el?.querySelector<HTMLElement>("input,select,textarea,button") ?? el)?.focus?.({ preventScroll: true });
    });
  };

  const next = () => {
    const errs = validateStep(step);
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError();
    if (returnToSummary) {
      // Après une modification depuis le récapitulatif, on revient directement au récapitulatif
      // si toutes les étapes sont valides.
      const firstInvalid = steps.find((s) => s !== "summary" && Object.keys(validateStep(s)).length);
      if (!firstInvalid) {
        setReturnToSummary(false);
        return go("summary");
      }
      return go(firstInvalid);
    }
    go(steps[Math.min(stepIndex + 1, steps.length - 1)]);
  };

  const back = () => go(steps[Math.max(stepIndex - 1, 0)]);

  const editFromSummary = (id: string) => {
    setReturnToSummary(true);
    go(id);
  };

  const restart = () => {
    if (!window.confirm(c.restartConfirm)) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignoré */
    }
    setFiles([]);
    setFileErrors([]);
    setReturnToSummary(false);
    setState(freshState());
    setErrors({});
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const errs: string[] = [];
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      const ext = (f.name.split(".").pop() ?? "").toLowerCase();
      if (!ACCEPT_EXT.has(ext)) errs.push(fmt(c.fileBadType, { name: f.name }));
      else if (f.size > MAX_MB * 1024 * 1024) errs.push(fmt(c.fileTooBig, { name: f.name, size: MAX_MB }));
      else accepted.push(f);
    }
    const merged = [...files, ...accepted];
    if (merged.length > MAX_FILES) errs.push(fmt(c.fileTooMany, { count: MAX_FILES }));
    setFiles(merged.slice(0, MAX_FILES));
    setFileErrors(errs);
  };

  const submit = async () => {
    // Revalidation complète avant l'envoi.
    for (const s of steps) {
      const errs = validateStep(s);
      if (Object.keys(errs).length) {
        if (s !== "summary") go(s);
        setErrors(errs);
        if (s !== "summary") setSubmitError(c.errors.fixBelow);
        return focusFirstError();
      }
    }
    setSubmitting(true);
    setSubmitError(null);
    const payload = {
      kind: state.kind,
      services: state.services,
      answers: state.answers,
      project: state.project,
      contact: state.contact,
      locale,
      consent: true,
      website: "",
      startedAt: state.startedAt,
    };
    const body = new FormData();
    body.set("payload", JSON.stringify(payload));
    const hp = document.getElementById("cfg-website") as HTMLInputElement | null;
    if (hp?.value) body.set("website", hp.value);
    for (const f of files) body.append("files", f);
    try {
      const res = await fetch("/api/requests", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignoré */
        }
        setDone({
          reference: data.reference,
          url: `${window.location.origin}/${locale}/suivi/${data.reference}?t=${encodeURIComponent(data.token)}`,
          emailSent: Boolean(data.emailSent),
          kind: state.kind,
          name: state.contact.name,
          email: state.contact.email,
        });
        setFiles([]);
        return;
      }
      if (res.status === 429) setSubmitError(d.common.tooMany);
      else if (data.error === "unavailable") {
        setSubmitError(c.errors.unavailable);
        go("services");
      } else if (data.error === "validation" && data.errors) {
        const slug = Object.keys(data.errors).find((k) => k !== "contact" && k !== "files");
        if (data.errors.files) {
          setFileErrors((data.errors.files as { name: string; reason: string }[]).map((f) =>
            f.reason === "tooBig" ? fmt(c.fileTooBig, { name: f.name, size: MAX_MB }) : f.reason === "tooMany" ? fmt(c.fileTooMany, { count: MAX_FILES }) : fmt(c.fileBadType, { name: f.name }),
          ));
          go("project");
        } else if (slug) {
          go(`svc:${slug}`);
          setErrors(data.errors[slug]);
        } else if (data.errors.contact) {
          go("contact");
          setErrors(data.errors.contact);
        }
        setSubmitError(c.errors.fixBelow);
      } else setSubmitError(d.common.error);
    } catch {
      setSubmitError(d.common.network);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────

  if (done) return <Confirmation done={done} d={d} locale={locale} loggedIn={loggedIn} copied={copied} setCopied={setCopied} />;

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink-muted" role="status">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">{d.common.loading}</span>
      </div>
    );
  }

  const total = steps.length;
  const progress = Math.round(((stepIndex + 1) / total) * 100);
  const isLast = step === "summary";
  const money = (n: number) => formatMoney(n, pricing.currency, locale);

  return (
    <div className="container-x py-8 sm:py-12">
      {/* Progression */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4 text-sm">
          <p className="font-medium text-ink-2">
            {fmt(c.stepOf, { current: stepIndex + 1, total })} · <span className="text-ink">{stepLabel(step)}</span>
          </p>
          <button type="button" onClick={restart} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {c.restart}
          </button>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-paper-3"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={stepIndex + 1}
          aria-valuetext={fmt(c.stepOf, { current: stepIndex + 1, total })}
        >
          <div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <ol className="mt-4 hidden flex-wrap gap-2 md:flex">
          {steps.map((s, i) => {
            const past = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={!past}
                  onClick={() => go(s)}
                  aria-current={current ? "step" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    current ? "bg-midnight text-white" : past ? "bg-white text-ink ring-1 ring-line hover:ring-ink/30" : "text-ink-muted"
                  }`}
                >
                  {past ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <span aria-hidden="true">{i + 1}.</span>}
                  {stepLabel(s)}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {submitError && (
            <p className="mb-6 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">
              {submitError}
            </p>
          )}

          {/* Étape 1 : services */}
          {step === "services" && (
            <section aria-labelledby="step-title" className="animate-fade-up">
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className="text-2xl outline-none sm:text-3xl">
                {c.servicesTitle}
              </h1>
              <p className="mt-2 text-ink-2">{c.servicesHelp}</p>
              <ul className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-invalid={errors.services ? "true" : undefined}>
                {services.map((s) => {
                  const on = state.services.includes(s.slug);
                  return (
                    <li key={s.slug}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleService(s.slug)}
                        className={`group flex h-full w-full flex-col rounded-2xl border p-5 text-start transition ${
                          on ? "border-midnight bg-midnight text-white shadow-pop" : "border-line bg-white hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-card"
                        }`}
                      >
                        <span className="flex w-full items-start justify-between">
                          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${on ? "bg-gold text-midnight" : "bg-paper-2 text-midnight"}`}>
                            <ServiceIcon name={s.icon} className="h-5 w-5" />
                          </span>
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full border ${on ? "border-gold bg-gold text-midnight" : "border-ink/20"}`}
                            aria-hidden="true"
                          >
                            {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </span>
                        </span>
                        <span className={`mt-4 font-semibold ${on ? "text-white" : "text-ink"}`}>{pick(s.name, locale)}</span>
                        <span className={`mt-1.5 text-sm leading-relaxed ${on ? "text-white/75" : "text-ink-2"}`}>{pick(s.description, locale)}</span>
                        <span className={`mt-4 text-xs font-semibold ${on ? "text-gold-sun" : "text-ink"}`}>
                          {on ? c.selected : d.home.chooseService}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {errors.services && (
                <p className="field-error mt-4" role="alert">
                  {c.pickService}
                </p>
              )}
            </section>
          )}

          {/* Étapes par service */}
          {step.startsWith("svc:") &&
            (() => {
              const def = services.find((s) => `svc:${s.slug}` === step);
              if (!def) return null;
              const a = state.answers[def.slug] ?? {};
              const qs = visibleQuestions(def, a);
              return (
                <section aria-labelledby="step-title" className="animate-fade-up" key={def.slug}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-midnight text-gold-sun">
                      <ServiceIcon name={def.icon} className="h-5 w-5" />
                    </span>
                    <h1 id="step-title" ref={headingRef} tabIndex={-1} className="text-2xl outline-none sm:text-3xl">
                      {pick(def.name, locale)}
                    </h1>
                  </div>
                  <p className="mt-3 text-ink-2">{c.serviceStepHelp}</p>
                  <div className="mt-8 space-y-8">
                    {qs.map((q) => (
                      <QuestionField
                        key={q.id}
                        q={q}
                        idPrefix={def.slug}
                        value={a[q.id]}
                        error={errors[q.id] as FieldError | undefined}
                        locale={locale}
                        d={d}
                        onChange={(v) => setAnswer(def.slug, q.id, v)}
                      />
                    ))}
                  </div>
                </section>
              );
            })()}

          {/* Projet : budget, délai, fichiers */}
          {step === "project" && (
            <section aria-labelledby="step-title" className="animate-fade-up">
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className="text-2xl outline-none sm:text-3xl">
                {c.projectTitle}
              </h1>
              <p className="mt-2 text-ink-2">{c.projectHelp}</p>
              <div className="mt-8 space-y-8">
                <QuestionField
                  q={{
                    id: "budget",
                    type: "single",
                    enabled: true,
                    unsure: true,
                    label: { fr: c.budget, en: c.budget, ar: c.budget },
                    options: BUDGETS.map((b) => {
                      const text = budgetLabel(b.value, c, d, money);
                      return { value: b.value, label: { fr: text, en: text, ar: text } };
                    }),
                  }}
                  idPrefix="project"
                  value={state.project.budget}
                  locale={locale}
                  d={d}
                  onChange={(v) => update({ project: { ...state.project, budget: v as string | undefined } })}
                />
                <QuestionField
                  q={{
                    id: "deadline",
                    type: "single",
                    enabled: true,
                    unsure: true,
                    label: { fr: c.deadline, en: c.deadline, ar: c.deadline },
                    options: DEADLINES.map((v) => ({ value: v, label: { fr: c.deadlines[v], en: c.deadlines[v], ar: c.deadlines[v] } })),
                  }}
                  idPrefix="project"
                  value={state.project.deadline}
                  locale={locale}
                  d={d}
                  onChange={(v) => update({ project: { ...state.project, deadline: v as string | undefined } })}
                />
                <div>
                  <label htmlFor="project-details" className="field-label">
                    {c.details} <span className="font-normal text-ink-muted">({d.common.optional})</span>
                  </label>
                  <textarea
                    id="project-details"
                    className="input"
                    rows={5}
                    maxLength={4000}
                    placeholder={c.detailsPlaceholder}
                    value={state.project.details ?? ""}
                    onChange={(e) => update({ project: { ...state.project, details: e.target.value || undefined } })}
                  />
                </div>
                <div>
                  <p className="field-label" id="files-label">
                    {c.files} <span className="font-normal text-ink-muted">({d.common.optional})</span>
                  </p>
                  <p className="field-help">{fmt(c.filesHelp, { count: MAX_FILES, size: MAX_MB })}</p>
                  <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/20 bg-paper-2 px-4 py-7 text-center text-sm text-ink-2 transition hover:border-cyan focus-within:border-cyan focus-within:ring-4 focus-within:ring-cyan/15">
                    <Paperclip className="h-5 w-5 text-cyan-deep" aria-hidden="true" />
                    <span className="font-semibold text-ink">{c.addFiles}</span>
                    <input
                      type="file"
                      multiple
                      accept={ACCEPT}
                      className="sr-only"
                      aria-describedby="files-label"
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {fileErrors.length > 0 && (
                    <ul className="mt-2 space-y-1" role="alert">
                      {fileErrors.map((m) => (
                        <li key={m} className="field-error">
                          {m}
                        </li>
                      ))}
                    </ul>
                  )}
                  {files.length > 0 && (
                    <>
                      <ul className="mt-3 space-y-2">
                        {files.map((f, i) => (
                          <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                              <span className="truncate">{f.name}</span>
                              <span className="shrink-0 text-xs text-ink-muted">{formatSize(f.size, locale)}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setFiles(files.filter((_, j) => j !== i))}
                              className="rounded-full p-1 text-ink-muted hover:bg-paper-2 hover:text-danger"
                              aria-label={`${d.common.remove} ${f.name}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="field-help mt-2">{c.filesNotSaved}</p>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Coordonnées */}
          {step === "contact" && (
            <section aria-labelledby="step-title" className="animate-fade-up">
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className="text-2xl outline-none sm:text-3xl">
                {c.contactTitle}
              </h1>
              <p className="mt-2 text-ink-2">{c.contactHelp}</p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <TextInput id="name" label={c.name} required autoComplete="name" value={state.contact.name} error={errors.name} d={d}
                  onChange={(v) => update({ contact: { ...state.contact, name: v } })} />
                <TextInput id="email" type="email" label={c.email} required autoComplete="email" value={state.contact.email} error={errors.email} d={d}
                  onChange={(v) => update({ contact: { ...state.contact, email: v } })} />
                <TextInput id="phone" type="tel" label={c.phone} required={phoneRequired(state.contact.contactPref)} optional={!phoneRequired(state.contact.contactPref)}
                  autoComplete="tel" value={state.contact.phone} error={errors.phone} d={d}
                  onChange={(v) => update({ contact: { ...state.contact, phone: v } })} />
                <TextInput id="company" label={c.company} optional autoComplete="organization" value={state.contact.company} error={errors.company} d={d}
                  onChange={(v) => update({ contact: { ...state.contact, company: v } })} />
                <TextInput id="country" label={c.country} required autoComplete="country-name" value={state.contact.country} error={errors.country} d={d}
                  onChange={(v) => update({ contact: { ...state.contact, country: v } })} />
                <div className="sm:col-span-2">
                  <fieldset>
                    <legend className="field-label">{c.contactPref}</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {CONTACT_PREFS.map((p) => (
                        <label key={p} className={`chip focus-within:ring-2 focus-within:ring-cyan ${state.contact.contactPref === p ? "chip-on" : ""}`}>
                          <input type="radio" name="contactPref" value={p} className="sr-only" checked={state.contact.contactPref === p}
                            onChange={() => update({ contact: { ...state.contact, contactPref: p } })} />
                          {p === "whatsapp" || p === "phone" ? <MessageCircle className="h-4 w-4" aria-hidden="true" /> : null}
                          {c.contactPrefs[p]}
                        </label>
                      ))}
                    </div>
                    {phoneRequired(state.contact.contactPref) && <p className="field-help">{c.phoneNeeded}</p>}
                  </fieldset>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="comments" className="field-label">
                    {c.comments} <span className="font-normal text-ink-muted">({d.common.optional})</span>
                  </label>
                  <textarea id="comments" className="input" rows={4} maxLength={3000} value={state.contact.comments}
                    onChange={(e) => update({ contact: { ...state.contact, comments: e.target.value } })} />
                </div>
              </div>
            </section>
          )}

          {/* Récapitulatif */}
          {step === "summary" && (
            <section aria-labelledby="step-title" className="animate-fade-up">
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className="text-2xl outline-none sm:text-3xl">
                {c.summaryTitle}
              </h1>
              <p className="mt-2 text-ink-2">{c.summaryHelp}</p>

              <div className="mt-8 space-y-4">
                <SummaryBlock title={c.summaryServices} onEdit={() => editFromSummary("services")} editLabel={d.common.edit}>
                  <ul className="flex flex-wrap gap-2">
                    {selectedDefs.map((s) => (
                      <li key={s.slug} className="badge bg-midnight px-3 py-1 text-white">
                        {pick(s.name, locale)}
                      </li>
                    ))}
                  </ul>
                </SummaryBlock>

                {describeAnswers(services, state.services, state.answers).map((sec) => (
                  <SummaryBlock key={sec.slug} title={pick(sec.name, locale)} onEdit={() => editFromSummary(`svc:${sec.slug}`)} editLabel={d.common.edit}>
                    {sec.items.length ? (
                      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                        {sec.items.map((it) => (
                          <div key={it.id}>
                            <dt className="text-xs font-medium text-ink-muted">{pick(it.label, locale)}</dt>
                            <dd className="mt-0.5 text-sm text-ink">{renderValue(it.value, locale, d)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-sm text-ink-muted">{d.common.notProvided}</p>
                    )}
                  </SummaryBlock>
                ))}

                <SummaryBlock title={c.summaryProject} onEdit={() => editFromSummary("project")} editLabel={d.common.edit}>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium text-ink-muted">{c.budget}</dt>
                      <dd className="mt-0.5 text-sm">{budgetLabel(state.project.budget, c, d, money)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-ink-muted">{c.deadline}</dt>
                      <dd className="mt-0.5 text-sm">
                        {state.project.deadline === UNSURE ? d.common.unsure : state.project.deadline ? c.deadlines[state.project.deadline as keyof typeof c.deadlines] : d.common.notProvided}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium text-ink-muted">{c.details}</dt>
                      <dd className="mt-0.5 whitespace-pre-line text-sm">{state.project.details || d.common.notProvided}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium text-ink-muted">{c.summaryFiles}</dt>
                      <dd className="mt-0.5 text-sm">{files.length ? files.map((f) => f.name).join(", ") : c.noFiles}</dd>
                    </div>
                  </dl>
                </SummaryBlock>

                <SummaryBlock title={c.summaryContact} onEdit={() => editFromSummary("contact")} editLabel={d.common.edit}>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {(
                      [
                        [c.name, state.contact.name],
                        [c.email, state.contact.email],
                        [c.phone, state.contact.phone],
                        [c.company, state.contact.company],
                        [c.country, state.contact.country],
                        [c.contactPref, c.contactPrefs[state.contact.contactPref as keyof typeof c.contactPrefs]],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs font-medium text-ink-muted">{k}</dt>
                        <dd className="mt-0.5 break-words text-sm">{v || d.common.notProvided}</dd>
                      </div>
                    ))}
                    {state.contact.comments && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-medium text-ink-muted">{c.comments}</dt>
                        <dd className="mt-0.5 whitespace-pre-line text-sm">{state.contact.comments}</dd>
                      </div>
                    )}
                  </dl>
                </SummaryBlock>

                <div className="lg:hidden">
                  <EstimateCard estimate={estimate} money={money} c={c} />
                </div>

                <fieldset className="rounded-2xl border border-line bg-white p-5">
                  <legend className="px-1 text-base font-semibold">{c.actionTitle}</legend>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["QUOTE", c.actionQuote, c.actionQuoteText, Send],
                        ["CALL", c.actionCall, c.actionCallText, MessageCircle],
                      ] as const
                    ).map(([k, title, text, Icon]) => (
                      <label
                        key={k}
                        className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-cyan ${
                          state.kind === k ? "border-midnight bg-midnight text-white" : "border-line hover:border-ink/30"
                        }`}
                      >
                        <input type="radio" name="kind" value={k} checked={state.kind === k} onChange={() => update({ kind: k })} className="sr-only" />
                        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${state.kind === k ? "text-gold-sun" : "text-cyan-deep"}`} aria-hidden="true" />
                        <span>
                          <span className="block font-semibold">{title}</span>
                          <span className={`mt-1 block text-sm ${state.kind === k ? "text-white/75" : "text-ink-2"}`}>{text}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink/30 accent-midnight"
                      checked={state.consent}
                      aria-invalid={Boolean(errors.consent)}
                      aria-describedby={errors.consent ? "consent-err" : undefined}
                      onChange={(e) => {
                        update({ consent: e.target.checked });
                        if (e.target.checked) setErrors({});
                      }}
                    />
                    <span>
                      {c.consent}{" "}
                      <Link href={`/${locale}/confidentialite`} target="_blank" className="font-medium text-ink underline underline-offset-2">
                        {c.consentLink}
                      </Link>
                      .
                    </span>
                  </label>
                  {errors.consent && (
                    <p id="consent-err" className="field-error" role="alert">
                      {c.errors.consent}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-ink-muted">{c.noPayment}</p>
                </div>
                {/* Champ piège pour les robots : invisible pour les humains. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label htmlFor="cfg-website">Website</label>
                  <input id="cfg-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>
              </div>
            </section>
          )}

          {/* Navigation */}
          <div className="sticky bottom-0 z-10 -mx-4 mt-10 flex items-center justify-between gap-3 border-t border-line bg-white/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <button type="button" onClick={back} disabled={stepIndex === 0} className="btn-ghost">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              {d.common.back}
            </button>
            {isLast ? (
              <button type="button" onClick={submit} disabled={submitting} className="btn-primary px-6">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />}
                {submitting ? c.submitting : c.submit}
              </button>
            ) : (
              <button type="button" onClick={next} className="btn-dark px-6">
                {returnToSummary ? c.seeSummary : d.common.next}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="mt-4 text-center text-xs text-ink-muted sm:text-start" aria-live="polite">
            {c.draftSaved}
          </p>
        </div>

        {/* Colonne latérale */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold">{c.yourSelection}</h2>
              {selectedDefs.length ? (
                <ul className="mt-3 space-y-2">
                  {selectedDefs.map((s) => (
                    <li key={s.slug} className="flex items-center gap-2.5 text-sm">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-paper-2 text-midnight">
                        <ServiceIcon name={s.icon} className="h-4 w-4" />
                      </span>
                      {pick(s.name, locale)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">{c.nothingYet}</p>
              )}
            </div>
            {selectedDefs.length > 0 && <EstimateCard estimate={estimate} money={money} c={c} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Sous-composants ──────────────────────────────────────────────────────

function renderValue(v: SnapshotValue, locale: Locale, d: Dict) {
  if (v.kind === "unsure") return <span className="text-cyan-deep">{d.common.unsure}</span>;
  if (v.kind === "text") return <span className="whitespace-pre-line break-words">{v.text}</span>;
  return v.labels.map((l) => pick(l, locale)).join(", ");
}

function budgetLabel(value: string | undefined, c: Dict["configurator"], d: Dict, money: (n: number) => string) {
  if (!value) return d.common.notProvided;
  if (value === UNSURE) return d.common.unsure;
  const b = BUDGETS.find((x) => x.value === value);
  if (!b) return value;
  return fmt(c.budgets[b.value], { a: money("min" in b ? b.min : b.max), b: "max" in b ? money(b.max) : "" });
}

function SummaryBlock({ title, onEdit, editLabel, children }: { title: string; onEdit: () => void; editLabel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base">{title}</h2>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-ink hover:bg-paper-2" aria-label={`${editLabel} : ${title}`}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> {editLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

function EstimateCard({ estimate, money, c }: { estimate: ReturnType<typeof computeEstimate>; money: (n: number) => string; c: Dict["configurator"] }) {
  return (
    <div className="rounded-2xl bg-midnight p-5 text-white">
      <h2 className="text-sm font-semibold text-white/80">{c.estimateTitle}</h2>
      {estimate.kind === "range" ? (
        <>
          <p className="mt-2 text-2xl font-bold text-gold-sun" aria-live="polite">
            {estimate.min === estimate.max ? money(estimate.min) : `${money(estimate.min)} – ${money(estimate.max)}`}
          </p>
          {estimate.urgentApplied && <p className="mt-1 text-xs text-white/70">{c.estimateUrgent}</p>}
          <p className="mt-3 text-xs leading-relaxed text-white/65">{c.estimateDisclaimer}</p>
        </>
      ) : (
        <>
          <p className="mt-2 text-xl font-bold text-gold-sun">{c.customQuote}</p>
          <p className="mt-2 text-xs leading-relaxed text-white/65">{c.customQuoteText}</p>
        </>
      )}
    </div>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  error,
  d,
  type = "text",
  required,
  optional,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: FieldError | "consent";
  d: Dict;
  type?: string;
  required?: boolean;
  optional?: boolean;
  autoComplete?: string;
}) {
  const errId = error ? `${id}-err` : undefined;
  return (
    <div>
      <label htmlFor={`c-${id}`} className="field-label">
        {label}
        {required && <span className="text-danger" aria-hidden="true"> *</span>}
        {optional && <span className="font-normal text-ink-muted"> ({d.common.optional})</span>}
      </label>
      <input
        id={`c-${id}`}
        type={type}
        className="input"
        value={value}
        required={required}
        autoComplete={autoComplete}
        dir={type === "email" || type === "tel" ? "ltr" : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={errId}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && error !== "consent" && (
        <p id={errId} className="field-error" role="alert">
          {d.configurator.errors[error]}
        </p>
      )}
    </div>
  );
}

function Confirmation({
  done,
  d,
  locale,
  loggedIn,
  copied,
  setCopied,
}: {
  done: Done;
  d: Dict;
  locale: Locale;
  loggedIn: boolean;
  copied: boolean;
  setCopied: (v: boolean) => void;
}) {
  const t = d.confirmation;
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(done.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* presse-papiers indisponible */
    }
  };
  return (
    <div className="container-x py-12 sm:py-16">
      <div className="mx-auto max-w-2xl animate-fade-up">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft text-success">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 ref={ref} tabIndex={-1} className="mt-6 text-3xl outline-none sm:text-4xl">
          {done.kind === "CALL" ? t.callTitle : t.title}
        </h1>
        <p className="mt-3 text-lg text-ink-2">{fmt(t.text, { name: done.name })}</p>

        <div className="mt-8 rounded-2xl bg-midnight p-6 text-white">
          <p className="text-sm text-white/70">{t.reference}</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-gold-sun" dir="ltr">
            {done.reference}
          </p>
          <p className="mt-4 text-sm text-white/75">{t.trackHelp}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link href={done.url.replace(window.location.origin, "")} className="btn-primary">
              {t.track}
            </Link>
            <button type="button" onClick={copy} className="btn-ghost-dark">
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span aria-live="polite">{copied ? t.copied : t.copy}</span>
            </button>
          </div>
        </div>

        <p className={`mt-5 rounded-xl px-4 py-3 text-sm ${done.emailSent ? "bg-success-soft text-success" : "bg-gold-soft text-midnight"}`}>
          {done.emailSent ? fmt(t.emailSent, { email: done.email }) : t.emailNotSent}
        </p>

        <h2 className="mt-10 text-xl">{t.nextTitle}</h2>
        <ol className="mt-4 space-y-3">
          {(done.kind === "CALL" ? t.callNext : t.next).map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-xs font-bold text-midnight">{i + 1}</span>
              <span className="pt-0.5 text-ink-2">{s}</span>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          {!loggedIn && (
            <Link href={`/${locale}/espace/inscription`} className="btn-dark">
              {t.account}
            </Link>
          )}
          <Link href={`/${locale}`} className="btn-ghost">
            {t.home}
          </Link>
        </div>
      </div>
    </div>
  );
}
