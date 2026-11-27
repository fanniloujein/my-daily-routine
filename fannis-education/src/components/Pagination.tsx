import Link from "next/link";
import { fmt } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dict";
import { buttonClasses } from "@/components/ui";

export function Pagination({ page, pages, hrefFor, t }: { page: number; pages: number; hrefFor: (p: number) => string; t: Dict }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-between gap-3 text-sm" aria-label="pagination">
      {page > 1 ? <Link href={hrefFor(page - 1)} className={buttonClasses("secondary", "sm")}>{t.common.previous}</Link> : <span />}
      <span className="text-ink-muted">{fmt(t.common.page, { page, pages })}</span>
      {page < pages ? <Link href={hrefFor(page + 1)} className={buttonClasses("secondary", "sm")}>{t.common.next}</Link> : <span />}
    </nav>
  );
}

export function qs(base: string, params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}
