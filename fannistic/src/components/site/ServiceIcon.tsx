import { BookOpen, FileText, Globe, IdCard, Palette, PenTool, Presentation, Share2, Sparkles, type LucideIcon } from "lucide-react";

export const SERVICE_ICONS: Record<string, LucideIcon> = {
  globe: Globe,
  "pen-tool": PenTool,
  palette: Palette,
  "id-card": IdCard,
  "book-open": BookOpen,
  "file-text": FileText,
  share: Share2,
  presentation: Presentation,
  sparkles: Sparkles,
};

export const ICON_NAMES = Object.keys(SERVICE_ICONS);

export function ServiceIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const Icon = SERVICE_ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.8} />;
}
