"use client";

import { useState } from "react";

// Graphiques légers, sans dépendance : barres verticales (une série) et barres horizontales.
// Les textes utilisent les couleurs d'encre ; la couleur ne porte que l'identité de la barre.

export function BarChart({
  data,
  color = "rgb(var(--primary))",
  goal,
  format = (v: number) => String(v),
  height = 160,
}: {
  data: { label: string; value: number; tooltip?: string }[];
  color?: string;
  goal?: number;
  format?: (v: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, goal ?? 0, ...data.map((d) => d.value));
  return (
    <figure>
      <div className="relative" style={{ height }}>
        {/* lignes de repère discrètes */}
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-line/70" style={{ bottom: `${f * 100}%` }} />
        ))}
        {goal ? (
          <div className="absolute inset-x-0 border-t-2 border-ink-2/40" style={{ bottom: `${(goal / max) * 100}%` }}>
            <span className="absolute -top-4 right-0 text-[10px] text-muted">objectif {format(goal)}</span>
          </div>
        ) : null}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d, i) => (
            <div
              key={i}
              className="relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${d.label} : ${d.tooltip ?? format(d.value)}`}
            >
              <div
                className="w-full max-w-[28px] rounded-t-[4px] transition-all duration-500"
                style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0, background: color, opacity: hover === null || hover === i ? 1 : 0.55 }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-navy px-2 py-1 text-[11px] text-white shadow-pop dark:bg-surface-2 dark:text-ink">
                  <strong>{d.label}</strong> · {d.tooltip ?? format(d.value)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-[2px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 truncate text-center text-[10px] text-muted">
            {d.label}
          </div>
        ))}
      </div>
    </figure>
  );
}

export function HBars({ data, format = (v: number) => String(v) }: { data: { label: string; value: number; color: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="text-sm" title={`${d.label} : ${format(d.value)}`}>
          <div className="mb-1 flex justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-ink-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="shrink-0 text-xs font-medium text-ink">{format(d.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
