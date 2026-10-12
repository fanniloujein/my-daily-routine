"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { cx } from "@/lib/client";

// ───────────── Boutons ─────────────

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "soft" | "success" | "white" | "glass";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-primary-strong text-white hover:bg-primary-strong/90 shadow-sm dark:text-[#0e1322]",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:bg-danger/90 dark:text-[#0e1322]",
  soft: "bg-primary-soft text-primary-strong hover:bg-primary-soft/70",
  success: "bg-success-soft text-success hover:bg-success-soft/70",
  white: "bg-white text-[#1e2a4a] hover:bg-white/90 shadow-sm",
  glass: "bg-white/10 text-white hover:bg-white/20",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg" | "icon"; loading?: boolean }) {
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-base", icon: "h-9 w-9" };
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        BTN[variant],
        sizes[size],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// ───────────── Cartes et éléments de mise en page ─────────────

export function Card({ title, icon, action, children, className, bodyClass }: { title?: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx("card animate-fade-in", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-5">
          <h2 className="flex min-w-0 items-center gap-2 section-title">
            {icon && <span className="text-primary">{icon}</span>}
            <span className="truncate">{title}</span>
          </h2>
          {action}
        </header>
      )}
      <div className={cx("p-4 sm:p-5", title || action ? "pt-3 sm:pt-3" : "", bodyClass)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-8 text-center">
      {icon && <div className="text-lavender">{icon}</div>}
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {children && <p className="max-w-sm text-xs text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "lavender"; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2",
    primary: "bg-primary-soft text-primary-strong",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    lavender: "bg-lavender-soft text-lavender",
  };
  return <span className={cx("chip", tones[tone], className)}>{children}</span>;
}

export function Progress({ value, tone = "primary", className }: { value: number; tone?: "primary" | "success" | "warning" | "lavender"; className?: string }) {
  const tones = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", lavender: "bg-lavender" };
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-all duration-500", tones[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 72, stroke = 7, label }: { value: number; size?: number; stroke?: number; label?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--success))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(100, value)) / 100}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-sm font-semibold text-ink">{label ?? `${Math.round(value)} %`}</span>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("h-5 w-5 animate-spin text-muted", className)} />;
}

export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{error instanceof Error ? error.message : "Impossible de charger les données."}</div>
      {onRetry && (
        <button className="text-xs font-medium underline" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warning" | "success" | "danger"; children: ReactNode; className?: string }) {
  const map = {
    info: ["bg-primary-soft text-primary-strong", Info],
    warning: ["bg-warning-soft text-warning", AlertTriangle],
    success: ["bg-success-soft text-success", CheckCircle2],
    danger: ["bg-danger-soft text-danger", AlertTriangle],
  } as const;
  const [cls, Ico] = map[tone];
  return (
    <div className={cx("flex items-start gap-2 rounded-xl p-3 text-sm", cls, className)}>
      <Ico className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}

// ───────────── Formulaires ─────────────

export function Field({ label, error, hint, children, className }: { label: string; error?: string | null; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-danger">{error}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 rounded-xl py-1 text-left">
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <span className={cx("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-primary" : "bg-line")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function Segmented<T extends string | number>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cx("inline-flex flex-wrap rounded-xl bg-surface-2 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx("rounded-lg px-3 py-1.5 text-xs font-medium transition", value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const WEEKDAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="flex flex-wrap gap-1">
      {order.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
            className={cx("h-8 w-11 rounded-lg text-xs font-medium transition", on ? "bg-primary text-white dark:text-[#0e1322]" : "bg-surface-2 text-ink-2 hover:bg-primary-soft")}
            aria-pressed={on}
          >
            {WEEKDAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

// ───────────── Fenêtre modale ─────────────

export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,select,textarea,button[data-autofocus]")?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy/30 backdrop-blur-[2px] dark:bg-black/50" onClick={onClose} />
      <div ref={ref} className={cx("relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-surface shadow-pop animate-scale-in sm:rounded-3xl", widths[size])}>
        <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line/70 px-5 py-3 safe-bottom">{footer}</div>}
      </div>
    </div>
  );
}

// ───────────── Notifications « toast » et confirmations ─────────────

type Toast = { id: number; message: string; tone: "success" | "info" | "warning" | "danger"; action?: { label: string; onClick: () => void } };
type ConfirmOpts = { title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean };

const UiCtx = createContext<{
  toast: (message: string, tone?: Toast["tone"], action?: Toast["action"]) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
} | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);

  const toast = useCallback((message: string, tone: Toast["tone"] = "success", action?: Toast["action"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, message, tone, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 7000 : 4000);
  }, []);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  return (
    <UiCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-pop animate-fade-in",
              t.tone === "success" && "bg-navy text-white dark:bg-surface-2 dark:text-ink",
              t.tone === "info" && "bg-navy text-white dark:bg-surface-2 dark:text-ink",
              t.tone === "warning" && "bg-warning text-white dark:text-[#0e1322]",
              t.tone === "danger" && "bg-danger text-white dark:text-[#0e1322]",
            )}
          >
            {t.tone === "success" && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                className="font-semibold underline underline-offset-2"
                onClick={() => {
                  t.action!.onClick();
                  setToasts((x) => x.filter((y) => y.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
      <Modal
        open={!!confirmState}
        onClose={() => close(false)}
        title={confirmState?.title ?? ""}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Annuler
            </Button>
            <Button variant={confirmState?.danger ? "danger" : "primary"} onClick={() => close(true)} data-autofocus>
              {confirmState?.confirmLabel ?? "Confirmer"}
            </Button>
          </>
        }
      >
        <div className="text-sm text-ink-2">{confirmState?.message}</div>
      </Modal>
    </UiCtx.Provider>
  );
}

export function useUi() {
  const ctx = useContext(UiCtx);
  if (!ctx) throw new Error("useUi doit être utilisé dans UiProvider");
  return ctx;
}
