/** Petit histogramme accessible en CSS (aucune dépendance). */
export function BarChart({ data, format = (v) => String(v), label }: { data: { label: string; value: number }[]; format?: (v: number) => string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure>
      <div className="flex h-40 items-end gap-2" role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}`}>
        {data.map((d, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1 text-center">
            <span className="truncate text-[10px] text-ink-muted">{d.value ? format(d.value) : ""}</span>
            <div className="w-full rounded-t-md bg-brand-300" style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex gap-2">
        {data.map((d, i) => <span key={i} className="min-w-0 flex-1 truncate text-center text-[10px] text-ink-muted">{d.label}</span>)}
      </figcaption>
    </figure>
  );
}
