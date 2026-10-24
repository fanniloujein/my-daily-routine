import { Users } from "lucide-react";
import { cx } from "@/lib/client";

/** Texte lisible (blanc ou bleu nuit) selon la clarté de la couleur de fond. */
export function textOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "#1b2540" : "#ffffff";
}

/** Nom d'un élève (ou d'un groupe) sur toute sa couleur. */
export function NameTag({ name, color, group, size = "md", className }: { name: string; color: string; group?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "px-2 py-0.5 text-[11px]", md: "px-2.5 py-1 text-xs", lg: "px-3 py-1.5 text-sm" };
  return (
    <span
      className={cx("inline-flex max-w-full items-center gap-1 truncate rounded-full font-semibold", sizes[size], className)}
      style={{ background: color, color: textOn(color) }}
      title={group ? `Groupe : ${name}` : name}
    >
      {group && <Users className="h-3 w-3 shrink-0" aria-hidden />}
      <span className="truncate">{name}</span>
    </span>
  );
}
