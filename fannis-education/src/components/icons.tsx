import {
  BarChart3, BookOpen, Calculator, Calendar, CalendarClock, CreditCard, FileText, GraduationCap, Globe2,
  Landmark, Languages, LayoutDashboard, Library, ListChecks, Mail, MessageSquare, Monitor, Settings, Tags,
  TrendingUp, User, Users, Briefcase, Brain, Feather, ScrollText, Dumbbell, Wallet, ClipboardCheck, Layers,
  BookMarked, Receipt, Bell, type LucideIcon,
} from "lucide-react";

/** Icônes autorisées (référencées par nom en base ou depuis un composant serveur). */
export const ICONS = {
  dashboard: LayoutDashboard,
  book: BookOpen,
  library: Library,
  progress: TrendingUp,
  users: Users,
  user: User,
  calendar: Calendar,
  clock: CalendarClock,
  card: CreditCard,
  wallet: Wallet,
  file: FileText,
  cap: GraduationCap,
  chart: BarChart3,
  quiz: ListChecks,
  settings: Settings,
  mail: Mail,
  message: MessageSquare,
  tags: Tags,
  layers: Layers,
  receipt: Receipt,
  check: ClipboardCheck,
  bookmark: BookMarked,
  bell: Bell,
  // matières
  economy: TrendingUp,
  management: Briefcase,
  math: Calculator,
  history: Landmark,
  globe: Globe2,
  language: Languages,
  philosophy: Brain,
  literature: Feather,
  arabic: ScrollText,
  computer: Monitor,
  sport: Dumbbell,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "h-5 w-5" }: { name?: string | null; className?: string }) {
  const C = (name && (ICONS as Record<string, LucideIcon>)[name]) || BookOpen;
  return <C className={className} aria-hidden />;
}
