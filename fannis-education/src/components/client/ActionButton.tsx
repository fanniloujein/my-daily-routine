"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action";
import { buttonClasses } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { useToast } from "./Toaster";

type Variant = Parameters<typeof buttonClasses>[0];

/**
 * Bouton qui déclenche une action serveur, avec confirmation facultative
 * et saisie facultative d'un texte (motif, lien…).
 */
export function ActionButton({
  action,
  children,
  confirmText,
  input,
  variant = "secondary",
  size = "sm",
  successText,
  className,
}: {
  action: (value?: string) => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  confirmText?: string;
  input?: { label: string; required?: boolean; type?: "text" | "url" | "number"; placeholder?: string; defaultValue?: string };
  variant?: Variant;
  size?: "sm" | "md";
  successText?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(input?.defaultValue ?? "");
  const dialogRef = useRef<HTMLDialogElement>(null);

  function run(v?: string) {
    start(async () => {
      const res = await action(v);
      if (res.ok) {
        toast(res.message ?? successText ?? t.common.done);
        setOpen(false);
        dialogRef.current?.close();
        router.refresh();
      } else {
        toast(errorText(res.error) ?? t.errors.generic, "error");
      }
    });
  }

  function onClick() {
    if (input || confirmText) {
      setOpen(true);
      requestAnimationFrame(() => dialogRef.current?.showModal());
      return;
    }
    run();
  }

  return (
    <>
      <button type="button" disabled={pending} onClick={onClick} className={buttonClasses(variant, size, className)}>
        {pending ? t.common.loading : children}
      </button>
      {open && (
        <dialog
          ref={dialogRef}
          onClose={() => setOpen(false)}
          className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gray-100 p-0 shadow-card backdrop:bg-ink/30"
        >
          <form
            method="dialog"
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (input?.required && !value.trim()) return;
              run(input ? value.trim() : undefined);
            }}
          >
            <p className="font-semibold text-ink">{confirmText ?? t.common.confirmAction}</p>
            {input && (
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">{input.label}</span>
                {input.type === "text" || !input.type ? (
                  <textarea className="input min-h-[80px]" value={value} onChange={(e) => setValue(e.target.value)} required={input.required} maxLength={500} placeholder={input.placeholder} />
                ) : (
                  <input className="input" type={input.type} value={value} onChange={(e) => setValue(e.target.value)} required={input.required} placeholder={input.placeholder} />
                )}
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className={buttonClasses("ghost", "sm")} onClick={() => dialogRef.current?.close()}>
                {t.common.cancel}
              </button>
              <button type="submit" disabled={pending} className={buttonClasses(variant === "danger" ? "danger" : "primary", "sm")}>
                {pending ? t.common.loading : t.common.confirm}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
