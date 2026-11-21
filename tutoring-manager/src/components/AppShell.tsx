"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell, BookOpen, CalendarDays, CalendarRange, ChartPie, ClipboardList, Clock, FileText, FolderOpen, GraduationCap, LayoutDashboard,
  ListChecks, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings, Shapes, Sun, SunMoon, Users, Wallet, X, Plus,
} from "lucide-react";
import { api, cn, useApi } from "@/lib/client";
import { useApp } from "./providers";
import { Button } from "./ui";
import type { Messages } from "@/i18n";
import { longDate, today } from "@/lib/dates";

type Item = { href: string; key: keyof Messages; icon: typeof Users };
const NAV: { group: keyof Messages; items: Item[] }[] = [
  {
    group: "nav.group.activity",
    items: [
      { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
      { href: "/eleves", key: "nav.students", icon: Users },
      { href: "/seances", key: "nav.sessions", icon: ClipboardList },
      { href: "/calendrier", key: "nav.calendar", icon: CalendarDays },
      { href: "/semaine", key: "nav.week", icon: CalendarRange },
    ],
  },
  {
    group: "nav.group.money",
    items: [
      { href: "/finances", key: "nav.finance", icon: Wallet },
      { href: "/finances/journal", key: "nav.journal", icon: ReceiptText },
    ],
  },
  {
    group: "nav.group.pedagogy",
    items: [
      { href: "/preparations", key: "nav.preparations", icon: BookOpen },
      { href: "/devoirs", key: "nav.homework", icon: FileText },
      { href: "/documents", key: "nav.documents", icon: FolderOpen },
      { href: "/matieres", key: "nav.subjects", icon: Shapes },
    ],
  },
  {
    group: "nav.group.organization",
    items: [
      { href: "/taches", key: "nav.tasks", icon: ListChecks },
      { href: "/temps", key: "nav.time", icon: Clock },
      { href: "/rapports", key: "nav.reports", icon: ChartPie },
      { href: "/notifications", key: "nav.notifications", icon: Bell },
      { href: "/parametres", key: "nav.settings", icon: Settings },
    ],
  },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : href === "/finances" ? path === "/finances" : path === href || path.startsWith(`${href}/`));

export function AppShell({ children, appName }: { children: ReactNode; appName: string }) {
  const path = usePathname();
  const router = useRouter();
  const { t, theme, setTheme } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const { data: notifs } = useApi<{ id: string; readAt: string | null }[]>("/api/notifications", { refreshInterval: 120_000 });
  const unread = notifs?.filter((n) => !n.readAt).length ?? 0;

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("ftm-sidebar") === "1");
    } catch {}
  }, []);
  useEffect(() => setMobile(false), [path]);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("ftm-sidebar", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };
  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : SunMoon;

  const sidebar = (compact: boolean) => (
    <div className="flex h-full flex-col bg-navy text-white/85">
      <div className={cn("flex h-16 items-center gap-2.5 px-4", compact && "justify-center px-0")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#8fb8e8] text-navy">
          <GraduationCap className="h-5 w-5" />
        </span>
        {!compact && (
          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-[15px] font-bold text-white">{appName}</div>
            <div className="text-[11px] text-white/50">Espace privé</div>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 pb-4 pt-2">
        {NAV.map((g) => (
          <div key={g.group}>
            {!compact && <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-white/35">{t(g.group)}</div>}
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const active = isActive(path, it.href);
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    title={compact ? t(it.key) : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition",
                      active ? "bg-white/12 font-medium text-white" : "hover:bg-white/[.06] hover:text-white",
                      compact && "justify-center px-0",
                    )}
                  >
                    {active && <span className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-1 rounded-r-full bg-[#f3d77a]" />}
                    <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[#a8c7f0]" : "text-white/60 group-hover:text-white")} />
                    {!compact && <span className="truncate">{t(it.key)}</span>}
                    {it.href === "/notifications" && unread > 0 && (
                      <span className={cn("rounded-full bg-[#f2a7a0] px-1.5 text-[10px] font-bold text-navy", compact ? "absolute right-1 top-1" : "ml-auto")}>{unread}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className={cn("border-t border-white/10 p-2.5", compact && "flex flex-col items-center gap-1")}>
        <button onClick={logout} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-white/70 hover:bg-white/[.06] hover:text-white", compact && "justify-center px-0")} title={t("action.logout")}>
          <LogOut className="h-[18px] w-[18px]" />
          {!compact && t("action.logout")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block", collapsed ? "w-[72px]" : "w-64")}>{sidebar(collapsed)}</aside>
      {mobile && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setMobile(false)} />
          <div className="absolute inset-y-0 left-0 w-72 animate-fade-in shadow-pop">
            {sidebar(false)}
            <button className="absolute right-3 top-4 text-white/70" onClick={() => setMobile(false)} aria-label="Fermer le menu">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line/70 bg-bg/85 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobile(true)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={toggle} aria-label={collapsed ? t("action.expand") : t("action.collapse")} title={collapsed ? t("action.expand") : t("action.collapse")}>
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
          <div className="hidden text-sm capitalize text-muted sm:block">{longDate(today())}</div>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/seances?new=1" className="hidden sm:block">
              <Button size="sm" variant="soft"><Plus className="h-4 w-4" />Séance</Button>
            </Link>
            <Link href="/finances?pay=1" className="hidden sm:block">
              <Button size="sm" variant="accent"><Wallet className="h-4 w-4" />Paiement</Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setTheme(nextTheme)} title={`Thème : ${t(`theme.${theme}` as keyof Messages)}`} aria-label="Changer de thème">
              <ThemeIcon className="h-[18px] w-[18px]" />
            </Button>
            <Link href="/notifications" className="relative" aria-label="Notifications">
              <Button variant="ghost" size="icon" tabIndex={-1}><Bell className="h-[18px] w-[18px]" /></Button>
              {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
