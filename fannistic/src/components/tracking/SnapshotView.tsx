import { fmt, formatMoney, type Dict } from "@/i18n";
import { pick, UNSURE, type Locale } from "@/lib/services/types";
import { BUDGETS } from "@/lib/services/project";
import type { SnapshotSection } from "@/lib/services/describe";

export interface Snapshot {
  sections: SnapshotSection[];
  project?: { budget?: string; deadline?: string; details?: string };
}

/** Affiche les réponses enregistrées d'une demande (côté client et administration). */
export function SnapshotView({ snapshot, locale, d, currency }: { snapshot: Snapshot; locale: Locale; d: Dict; currency: string }) {
  const c = d.configurator;
  const p = snapshot.project ?? {};
  const budget = (() => {
    if (!p.budget) return d.common.notProvided;
    if (p.budget === UNSURE) return d.common.unsure;
    const b = BUDGETS.find((x) => x.value === p.budget);
    if (!b) return p.budget;
    const money = (n: number) => formatMoney(n, currency, locale);
    return fmt(c.budgets[b.value], { a: money("min" in b ? b.min : b.max), b: "max" in b ? money(b.max) : "" });
  })();
  const deadline = !p.deadline ? d.common.notProvided : p.deadline === UNSURE ? d.common.unsure : c.deadlines[p.deadline as keyof typeof c.deadlines] ?? p.deadline;

  return (
    <div className="space-y-4">
      {snapshot.sections.map((sec) => (
        <div key={sec.slug} className="rounded-xl border border-line p-4">
          <h3 className="text-sm font-semibold">{pick(sec.name, locale)}</h3>
          {sec.items.length ? (
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {sec.items.map((it) => (
                <div key={it.id}>
                  <dt className="text-xs font-medium text-ink-muted">{pick(it.label, locale)}</dt>
                  <dd className="mt-0.5 whitespace-pre-line break-words text-sm">
                    {it.value.kind === "unsure" ? (
                      <span className="text-cyan-deep">{d.common.unsure}</span>
                    ) : it.value.kind === "text" ? (
                      it.value.text
                    ) : (
                      it.value.labels.map((l) => pick(l, locale)).join(", ")
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">{d.common.notProvided}</p>
          )}
        </div>
      ))}
      <div className="rounded-xl border border-line p-4">
        <h3 className="text-sm font-semibold">{c.summaryProject}</h3>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-ink-muted">{c.budget}</dt>
            <dd className="mt-0.5 text-sm">{budget}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">{c.deadline}</dt>
            <dd className="mt-0.5 text-sm">{deadline}</dd>
          </div>
          {p.details && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-ink-muted">{c.details}</dt>
              <dd className="mt-0.5 whitespace-pre-line break-words text-sm">{p.details}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
