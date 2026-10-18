"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

export type Status = { kind: "idle" } | { kind: "busy" } | { kind: "ok"; text: string } | { kind: "error"; text: string };

/** Petit gestionnaire d'état « en cours / enregistré / erreur » pour les formulaires. */
export function useStatus() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const run = async (fn: () => Promise<unknown>, okText = "Enregistré") => {
    setStatus({ kind: "busy" });
    try {
      await fn();
      setStatus({ kind: "ok", text: okText });
      setTimeout(() => setStatus((s) => (s.kind === "ok" ? { kind: "idle" } : s)), 3000);
      return true;
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message });
      return false;
    }
  };
  return { status, run, busy: status.kind === "busy" };
}

export function StatusLine({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  if (status.kind === "busy")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Enregistrement…
      </span>
    );
  if (status.kind === "ok")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {status.text}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-danger" role="alert">
      <TriangleAlert className="h-4 w-4" aria-hidden="true" /> {status.text}
    </span>
  );
}

type L = { fr: string; en: string; ar: string };

/** Champ traduit (français obligatoire, anglais et arabe facultatifs). */
export function L10nField({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
  placeholder,
}: {
  label: string;
  value: L | undefined;
  onChange: (v: L) => void;
  multiline?: boolean;
  required?: boolean;
  placeholder?: Partial<L>;
}) {
  const v = value ?? { fr: "", en: "", ar: "" };
  const langs = [
    ["fr", "FR"],
    ["en", "EN"],
    ["ar", "AR"],
  ] as const;
  return (
    <fieldset>
      <legend className="field-label">
        {label}
        {required && <span className="text-danger"> *</span>}
      </legend>
      <div className="grid gap-2 md:grid-cols-3">
        {langs.map(([k, tag]) => {
          const props = {
            "aria-label": `${label} (${tag})`,
            className: "input",
            dir: k === "ar" ? "rtl" : "ltr",
            value: v[k],
            placeholder: placeholder?.[k] || tag,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...v, [k]: e.target.value }),
          };
          return (
            <div key={k} className="relative">
              <span className="pointer-events-none absolute end-2 top-2 rounded bg-paper-2 px-1.5 text-[10px] font-semibold text-ink-muted">{tag}</span>
              {multiline ? <textarea rows={3} {...props} /> : <input {...props} />}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-5 w-9 rounded-full bg-paper-3 transition peer-checked:bg-midnight peer-focus-visible:ring-2 peer-focus-visible:ring-cyan after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4" aria-hidden="true" />
      {label}
    </label>
  );
}
