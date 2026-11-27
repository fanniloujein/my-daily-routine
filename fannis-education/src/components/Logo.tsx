import Link from "next/link";

export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Fanni's Education">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100">
        <span className="absolute -end-1 -top-1 h-3.5 w-3.5 rounded-full bg-sun-300" aria-hidden />
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M22 10 12 5 2 10l10 5 10-5Z" />
          <path d="M6 12v5c3 2 9 2 12 0v-5" />
        </svg>
      </span>
      {!compact && (
        <span className="text-base font-bold tracking-tight text-ink" dir="ltr">
          Fanni&apos;s <span className="text-brand-600">Education</span>
        </span>
      )}
    </Link>
  );
}
