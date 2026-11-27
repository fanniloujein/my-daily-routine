import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

// ─────────── Boutons ───────────
type Variant = "primary" | "secondary" | "ghost" | "danger" | "sun";
type Size = "sm" | "md" | "lg";

export function buttonClasses(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap",
    size === "sm" && "px-3 py-1.5 text-sm",
    size === "md" && "px-4 py-2.5 text-sm",
    size === "lg" && "px-6 py-3 text-base",
    variant === "primary" && "bg-brand-600 text-white shadow-soft hover:bg-brand-700",
    variant === "secondary" && "border border-gray-200 bg-white text-ink shadow-soft hover:border-brand-200 hover:bg-brand-50",
    variant === "ghost" && "text-ink-soft hover:bg-surface hover:text-ink",
    variant === "danger" && "bg-red-50 text-red-700 hover:bg-red-100",
    variant === "sun" && "bg-sun-300 text-ink shadow-soft hover:bg-sun-400",
    extra,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" {...props} className={buttonClasses(variant, size, className)} />;
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClasses(variant, size, className)} />;
}

// ─────────── Cartes ───────────
export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div {...props} className={cn("min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-card sm:p-6", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

// ─────────── Badges ───────────
export type Tone = "gray" | "blue" | "yellow" | "green" | "red";
const toneClasses: Record<Tone, string> = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-brand-100 text-brand-800",
  yellow: "bg-sun-100 text-sun-700",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", toneClasses[tone], className)}>
      {children}
    </span>
  );
}

// ─────────── Alertes ───────────
export function Alert({ tone = "blue", title, children, action, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const border: Record<Tone, string> = {
    gray: "border-gray-200 bg-surface",
    blue: "border-brand-100 bg-brand-50",
    yellow: "border-sun-200 bg-sun-50",
    green: "border-emerald-100 bg-emerald-50",
    red: "border-red-100 bg-red-50",
  };
  return (
    <div role={tone === "red" ? "alert" : "status"} className={cn("flex flex-col gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-center sm:justify-between", border[tone], className)}>
      <div>
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className="text-ink-soft">{children}</div>}
      </div>
      {action}
    </div>
  );
}

// ─────────── En-têtes ───────────
export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && <div className="mb-2">{back}</div>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-muted sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ─────────── États vides ───────────
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-surface/60 px-6 py-10 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-500 shadow-soft">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-ink-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─────────── Statistiques ───────────
export function StatCard({ label, value, hint, icon, tone = "blue" }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "blue" | "yellow" | "gray" }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink-muted">{label}</p>
        {icon && (
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone === "blue" && "bg-brand-50 text-brand-600", tone === "yellow" && "bg-sun-100 text-sun-700", tone === "gray" && "bg-surface text-ink-soft")}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

// ─────────── Formulaires ───────────
export function Field({ label, htmlFor, error, hint, children, className }: { label: ReactNode; htmlFor?: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

// ─────────── Divers ───────────
export function ProgressBar({ value, className, tone = "blue" }: { value: number; className?: string; tone?: "blue" | "yellow" }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-gray-100", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", tone === "blue" ? "bg-brand-400" : "bg-sun-400")} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-sun-100 font-semibold text-brand-800",
        size === "sm" && "h-8 w-8 text-xs",
        size === "md" && "h-11 w-11 text-sm",
        size === "lg" && "h-16 w-16 text-lg",
      )}
    >
      {initials}
    </span>
  );
}

export function Stars({ value, count, label }: { value: number; count?: number; label?: string }) {
  const rounded = Math.round(value * 10) / 10;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-ink-soft" aria-label={label}>
      <span className="text-sun-500" aria-hidden>
        {"★".repeat(Math.round(value))}
        <span className="text-gray-200">{"★".repeat(5 - Math.round(value))}</span>
      </span>
      <span className="font-medium text-ink">{rounded.toFixed(1)}</span>
      {count !== undefined && <span className="text-ink-muted">({count})</span>}
    </span>
  );
}

export function DemoBadge({ label }: { label: string }) {
  return <Badge tone="yellow">{label}</Badge>;
}

/** Tableau responsive : défilement horizontal interne sur mobile, jamais de la page. */
export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-start text-xs uppercase tracking-wide text-ink-muted">
            {head.map((h, i) => (
              <th key={i} className="px-5 py-3 text-start font-medium sm:px-6">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-5 py-3 align-top sm:px-6", className)}>{children}</td>;
}

export function Tabs({ items }: { items: { href: string; label: ReactNode; active: boolean; count?: number }[] }) {
  return (
    <nav className="-mx-1 mb-5 flex gap-1 overflow-x-auto pb-1" aria-label="tabs">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition",
            it.active ? "bg-brand-100 text-brand-800" : "text-ink-soft hover:bg-surface",
          )}
        >
          {it.label}
          {it.count !== undefined && <span className="rounded-full bg-white/80 px-1.5 text-xs">{it.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
