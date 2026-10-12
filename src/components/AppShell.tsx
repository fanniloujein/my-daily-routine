"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell, BookOpenCheck, CalendarDays, ChartColumn, Clapperboard, Code, Dumbbell, GraduationCap, HeartPulse, Languages,
  LayoutDashboard, LogOut, Menu, MessagesSquare, Monitor, Moon, Plus, Settings, Sun, Tags, X, Zap, ListTodo, FolderKanban, Pill,
} from "lucide-react";
import { UiProvider, Modal, Button, useUi } from "./ui";
import { ActivityEditorProvider, useActivityEditor } from "./activity/ActivityEditorContext";
import { ReminderProvider } from "./ReminderEngine";
import { useTheme, type ThemePref } from "./theme";
import { api, cx, refreshAll } from "@/lib/client";
import { useCategories, useMe } from "@/lib/hooks";
import { addDays, today } from "@/lib/dates";
import { translate, type DictKey } from "@/i18n";

const NAV: { href: string; key: DictKey; icon: typeof LayoutDashboard }[] = [
  { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/planning", key: "nav.planning", icon: CalendarDays },
  { href: "/assistant", key: "nav.assistant", icon: MessagesSquare },
  { href: "/cours", key: "nav.tutoring", icon: GraduationCap },
  { href: "/projets", key: "nav.freelance", icon: Code },
  { href: "/allemand", key: "nav.german", icon: Languages },
  { href: "/sante", key: "nav.health", icon: HeartPulse },
  { href: "/sport", key: "nav.sport", icon: Dumbbell },
  { href: "/loisirs", key: "nav.leisure", icon: Clapperboard },
  { href: "/stats", key: "nav.stats", icon: ChartColumn },
  { href: "/bilan", key: "nav.review", icon: BookOpenCheck },
  { href: "/categories", key: "nav.categories", icon: Tags },
  { href: "/parametres", key: "nav.settings", icon: Settings },
];
const MOBILE_NAV = ["/", "/planning", "/assistant", "/cours"];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <UiProvider>
      <ReminderProvider>
        <ActivityEditorProvider>
          <Shell>{children}</Shell>
        </ActivityEditorProvider>
      </ReminderProvider>
    </UiProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        sessionStorage.removeItem("mlos-reloaded");
      } catch {}
    }, 5000);
    return () => clearTimeout(t);
  }, []);
  const router = useRouter();
  const { data: me } = useMe();
  const { pref, set } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const locale = (me?.locale ?? "fr") as "fr";
  const t = (k: DictKey) => translate(locale, k);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Barre latérale (ordinateur) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line/70 bg-surface/80 backdrop-blur lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
          <Logo />
          <div>
            <div className="font-display text-base font-semibold leading-tight text-ink">My Life OS</div>
            <div className="text-[11px] text-muted">Ton assistante personnelle</div>
          </div>
        </Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Navigation principale">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                active(n.href) ? "bg-primary-soft font-medium text-primary-strong" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <n.icon className="h-[18px] w-[18px]" /> {t(n.key)}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-line/70 p-3">
          <ThemeSwitch pref={pref} set={set} />
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink">
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        </div>
      </aside>

      {/* Barre supérieure (mobile / tablette) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line/60 bg-bg/85 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <Link href="/" className="flex items-center gap-2">
          <Logo small />
          <span className="font-display font-semibold text-ink">My Life OS</span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={() => set(pref === "dark" ? "light" : "dark")}
            className="rounded-xl p-2 text-ink-2 hover:bg-surface-2"
            aria-label="Changer de thème"
          >
            {pref === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button onClick={() => setMoreOpen(true)} className="rounded-xl p-2 text-ink-2 hover:bg-surface-2" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:pb-16 lg:pt-8">{children}</main>

      <QuickAdd />

      {/* Navigation basse (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/95 backdrop-blur safe-bottom lg:hidden" aria-label="Navigation mobile">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.filter((n) => MOBILE_NAV.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} className={cx("flex flex-col items-center gap-0.5 py-2 text-[10px]", active(n.href) ? "text-primary-strong" : "text-muted")}>
              <n.icon className="h-5 w-5" />
              <span className="max-w-[4.5rem] truncate">{t(n.key)}</span>
            </Link>
          ))}
          <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted">
            <Menu className="h-5 w-5" />
            {t("nav.more")}
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy/30 backdrop-blur-[2px]" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-pop animate-fade-in safe-bottom">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display font-semibold">Menu</span>
              <button onClick={() => setMoreOpen(false)} className="rounded-lg p-1.5 text-muted" aria-label="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setMoreOpen(false)}
                  className={cx("flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-xs", active(n.href) ? "bg-primary-soft text-primary-strong" : "bg-surface-2 text-ink-2")}
                >
                  <n.icon className="h-5 w-5" /> {t(n.key)}
                </Link>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <ThemeSwitch pref={pref} set={set} />
              <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2">
                <LogOut className="h-4 w-4" /> Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeSwitch({ pref, set }: { pref: ThemePref; set: (p: ThemePref) => void }) {
  const opts: { v: ThemePref; icon: typeof Sun; label: string }[] = [
    { v: "light", icon: Sun, label: "Clair" },
    { v: "dark", icon: Moon, label: "Sombre" },
    { v: "system", icon: Monitor, label: "Auto" },
  ];
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="Thème">
      {opts.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={pref === o.v}
          onClick={() => set(o.v)}
          className={cx("flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs", pref === o.v ? "bg-surface text-ink shadow-sm" : "text-muted")}
        >
          <o.icon className="h-3.5 w-3.5" /> {o.label}
        </button>
      ))}
    </div>
  );
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <span
      className={cx("inline-flex items-center justify-center rounded-xl font-display font-bold text-white", small ? "h-8 w-8 text-sm" : "h-10 w-10")}
      style={{ background: "linear-gradient(135deg,#1e2a4a 0%,#3460be 55%,#9b87f5 100%)" }}
      aria-hidden
    >
      L
    </span>
  );
}

/** Bouton flottant « + » : création rapide. */
function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [quickTask, setQuickTask] = useState(false);
  const editor = useActivityEditor();
  const router = useRouter();
  const items = [
    { label: "Activité", icon: CalendarDays, fn: () => editor.open() },
    { label: "Tâche rapide", icon: ListTodo, fn: () => setQuickTask(true) },
    { label: "Rappel", icon: Bell, fn: () => editor.open({ startTime: nextHalfHour(), endTime: "", durationMin: 15, reminders: [0], title: "" }) },
    { label: "Séance de cours", icon: GraduationCap, fn: () => router.push("/cours?new=lesson") },
    { label: "Projet", icon: FolderKanban, fn: () => router.push("/projets?new=project") },
    { label: "Session d'allemand", icon: Languages, fn: () => router.push("/allemand?new=session") },
    { label: "Médicament", icon: Pill, fn: () => router.push("/sante?new=med") },
  ];
  return (
    <>
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 lg:bottom-8 lg:right-8">
        {open && (
          <>
            <div className="fixed inset-0 -z-10" onClick={() => setOpen(false)} />
            <div className="mb-1 w-56 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-pop animate-scale-in">
              {items.map((i) => (
                <button
                  key={i.label}
                  onClick={() => {
                    setOpen(false);
                    i.fn();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink hover:bg-surface-2"
                >
                  <i.icon className="h-4 w-4 text-primary" /> {i.label}
                </button>
              ))}
            </div>
          </>
        )}
        <button
          onClick={() => setOpen(!open)}
          className={cx("flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-strong text-white shadow-pop transition hover:scale-105 active:scale-95 dark:text-[#0e1322]", open && "rotate-45")}
          aria-label="Ajouter rapidement"
          aria-expanded={open}
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
      <QuickTaskModal open={quickTask} onClose={() => setQuickTask(false)} />
    </>
  );
}

function nextHalfHour() {
  const d = new Date();
  const m = d.getHours() * 60 + d.getMinutes();
  const n = Math.min(23 * 60 + 30, Math.ceil((m + 1) / 30) * 30);
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

/** Ajout d'une tâche en quelques secondes : un titre, Entrée, c'est fait. */
function QuickTaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: cats } = useCategories();
  const { toast } = useUi();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<"today" | "tomorrow">("today");
  const [urgent, setUrgent] = useState(false);
  const [saving, setSaving] = useState(false);
  async function add() {
    if (!title.trim()) return;
    const cat = cats?.find((c) => c.kind === "personal") ?? cats?.[0];
    if (!cat) return;
    setSaving(true);
    try {
      const d = today();
      const date = when === "today" ? d : addDays(d, 1);
      await api("/api/activities", { body: { title: title.trim(), categoryId: cat.id, date, durationMin: 30, priority: urgent ? 4 : 2 } });
      await refreshAll();
      toast("Tâche ajoutée");
      setTitle("");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Tâche rapide" size="sm" footer={<Button onClick={add} loading={saving}>Ajouter</Button>}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="space-y-3"
      >
        <input className="input text-base" placeholder="Que dois-tu faire ?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "tomorrow"] as const).map((w) => (
            <button key={w} type="button" onClick={() => setWhen(w)} className={cx("rounded-full px-3 py-1 text-xs", when === w ? "bg-primary-soft text-primary-strong" : "bg-surface-2 text-ink-2")}>
              {w === "today" ? "Aujourd'hui" : "Demain"}
            </button>
          ))}
          <button type="button" onClick={() => setUrgent(!urgent)} className={cx("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs", urgent ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-2")}>
            <Zap className="h-3 w-3" /> Urgent
          </button>
        </div>
        <p className="text-xs text-muted">Sans horaire : « Organiser ma journée » lui trouvera une place.</p>
      </form>
    </Modal>
  );
}
