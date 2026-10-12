import {
  BookOpen, Briefcase, Clapperboard, Code, Coffee, Dumbbell, FileText, GraduationCap, Heart, Home, Languages, Leaf,
  Moon, Music, NotebookPen, Palette, Pill, Plane, ShoppingCart, Sparkles, Tag, Users, type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  "graduation-cap": GraduationCap,
  "notebook-pen": NotebookPen,
  code: Code,
  languages: Languages,
  dumbbell: Dumbbell,
  pill: Pill,
  moon: Moon,
  clapperboard: Clapperboard,
  heart: Heart,
  "file-text": FileText,
  "book-open": BookOpen,
  tag: Tag,
  briefcase: Briefcase,
  home: Home,
  music: Music,
  palette: Palette,
  plane: Plane,
  "shopping-cart": ShoppingCart,
  users: Users,
  sparkles: Sparkles,
  coffee: Coffee,
  leaf: Leaf,
};

export function CategoryIcon({ name, className = "h-4 w-4", style }: { name?: string | null; className?: string; style?: React.CSSProperties }) {
  const I = (name && ICONS[name]) || Tag;
  return <I className={className} style={style} aria-hidden />;
}

export function CategoryBadge({ category, size = "md" }: { category: { name: string; color: string; icon: string }; size?: "sm" | "md" }) {
  const s = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <span className={`inline-flex ${s} shrink-0 items-center justify-center rounded-xl`} style={{ backgroundColor: `${category.color}22`, color: category.color }} title={category.name}>
      <CategoryIcon name={category.icon} className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </span>
  );
}
