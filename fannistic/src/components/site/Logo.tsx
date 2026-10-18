/**
 * Logo Fanni’stic reconstitué en SVG d'après le kit officiel :
 * « F » arrondi (barre jaune), carré, étincelle cyan, apostrophe jaune.
 */
export function LogoMark({ tone = "dark", className = "h-9 w-9" }: { tone?: "dark" | "light"; className?: string }) {
  const stem = tone === "dark" ? "#0E1633" : "#FFFFFF";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect x="6" y="14" width="12" height="44" rx="6" fill={stem} />
      <rect x="6" y="14" width="34" height="12" rx="6" fill={tone === "dark" ? "#FFB800" : "#FFC21A"} />
      <rect x="24" y="32" width="11" height="11" rx="3" fill={stem} />
      <path d="M51 3c.9 6.6 2.9 8.6 9.5 9.5-6.6.9-8.6 2.9-9.5 9.5-.9-6.6-2.9-8.6-9.5-9.5C48.1 11.6 50.1 9.6 51 3Z" fill="#1FC8E3" />
    </svg>
  );
}

export function Logo({ tone = "dark", withTagline = false, className = "" }: { tone?: "dark" | "light"; withTagline?: boolean; className?: string }) {
  const text = tone === "dark" ? "text-midnight" : "text-white";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} dir="ltr">
      <LogoMark tone={tone} />
      <span className="flex flex-col leading-none">
        <span className={`font-sans text-[22px] font-bold tracking-tight ${text}`}>
          Fanni<span className={tone === "dark" ? "text-gold" : "text-gold-sun"}>’</span>stic
        </span>
        {withTagline && (
          <span className={`mt-1 text-[9px] font-medium uppercase tracking-[0.3em] ${tone === "dark" ? "text-ink-2" : "text-white/70"}`}>
            Design <span className="text-gold">•</span> Web <span className="text-gold">•</span> Branding
          </span>
        )}
      </span>
      <span className="sr-only">Fanni’stic</span>
    </span>
  );
}
