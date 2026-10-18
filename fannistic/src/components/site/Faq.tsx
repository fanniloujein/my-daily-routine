import { Plus } from "lucide-react";
import { pick, type L10n, type Locale } from "@/lib/services/types";

export function Faq({ items, locale }: { items: { id: string; question: L10n; answer: L10n }[]; locale: Locale }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {items.map((f) => (
        <details key={f.id} className="group px-5 py-1 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 text-start font-medium text-ink [&::-webkit-details-marker]:hidden">
            {pick(f.question, locale)}
            <Plus className="h-5 w-5 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-45" aria-hidden="true" />
          </summary>
          <p className="pb-5 text-[15px] leading-relaxed text-ink-2">{pick(f.answer, locale)}</p>
        </details>
      ))}
    </div>
  );
}
