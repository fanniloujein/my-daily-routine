"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/client";
import { Button } from "./button";

export function Card({ title, icon, action, children, className, bodyClass, href }: { title?: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; href?: string }) {
  return (
    <section className={cn("card animate-fade-in", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-5">
          <h2 className="flex min-w-0 items-center gap-2 section-title">
            {icon && <span className="text-primary-strong">{icon}</span>}
            {href ? <Link href={href} className="truncate hover:underline">{title}</Link> : <span className="truncate">{title}</span>}
          </h2>
          {action}
        </header>
      )}
      <div className={cn("p-4 sm:p-5", (title || action) && "pt-3 sm:pt-3", bodyClass)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong sm:flex">{icon}</div>}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[26px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  info: "bg-primary-soft text-primary-strong",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-ink",
  muted: "bg-surface-2 text-muted",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "muted", children, className, dot }: { tone?: Tone | string; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("chip", TONES[(tone as Tone) in TONES ? (tone as Tone) : "muted"], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Stat({ label, value, icon, tone = "info", hint, href }: { label: ReactNode; value: ReactNode; icon?: ReactNode; tone?: Tone; hint?: ReactNode; href?: string }) {
  const inner = (
    <div className="card flex h-full items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-pop">
      {icon && <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONES[tone])}>{icon}</div>}
      <div className="min-w-0">
        <div className="line-clamp-2 text-xs font-medium leading-snug text-muted">{label}</div>
        <div className="mt-0.5 font-display text-xl font-semibold tabular-nums text-ink">{value}</div>
        {hint && <div className="mt-0.5 line-clamp-2 text-xs text-muted">{hint}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-4 py-8 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div className="text-sm font-medium text-ink">{title}</div>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} />;
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      <span>{error instanceof Error ? error.message : "Impossible de charger les données."}</span>
      {retry && <Button size="sm" variant="secondary" onClick={retry}>Réessayer</Button>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-line px-1" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn("relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition", value === t.value ? "text-primary-strong" : "text-muted hover:text-ink")}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-xs text-muted">{t.count}</span>}
          {value === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary-strong" />}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, src, color, size = 36 }: { name: string; src?: string | null; color?: string | null; size?: number }) {
  const ini = name.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  // eslint-disable-next-line @next/next/no-img-element -- photos en data URL / route privée
  if (src) return <img src={src} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-navy" style={{ width: size, height: size, background: color || "rgb(var(--primary-soft))", fontSize: size * 0.38 }}>
      {ini}
    </span>
  );
}

export function usePager<T>(items: T[], size = 25) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(page, pages - 1);
  return { page: p, pages, setPage, slice: items.slice(p * size, p * size + size), total: items.length, size };
}

export function Pager({ page, pages, setPage, total, size }: { page: number; pages: number; setPage: (n: number) => void; total: number; size: number }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-muted">
      <span>
        {page * size + 1}–{Math.min(total, (page + 1) * size)} sur {total}
      </span>
      <div className="flex gap-1">
        <Button size="icon-sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Page précédente"><ChevronLeft className="h-4 w-4" /></Button>
        <Button size="icon-sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Page suivante"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
