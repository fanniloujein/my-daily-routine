"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Icon } from "@/components/icons";
import { cn } from "@/components/ui/cn";
import { useI18n } from "@/lib/i18n/client";

export type NavItem = { href: string; label: string; icon: string; badge?: number };

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

function Links({ items, rootHref, onNavigate }: { items: NavItem[]; rootHref: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((it) => {
        const active = isActive(pathname, it.href, it.href === rootHref);
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-brand-50 text-brand-800" : "text-ink-soft hover:bg-surface hover:text-ink",
              )}
            >
              <Icon name={it.icon} className={cn("h-[18px] w-[18px]", active ? "text-brand-600" : "text-ink-muted")} />
              <span className="flex-1">{it.label}</span>
              {!!it.badge && <span className="rounded-full bg-sun-300 px-2 py-0.5 text-xs font-semibold text-ink">{it.badge}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ShellNav({ items, rootHref, header, footer }: { items: NavItem[]; rootHref: string; header: React.ReactNode; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {/* Barre latérale (ordinateur) */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-gray-100 bg-white lg:flex">
        <div className="px-5 py-5">{header}</div>
        <nav className="flex-1 overflow-y-auto px-3">
          <Links items={items} rootHref={rootHref} />
        </nav>
        <div className="border-t border-gray-100 p-3">{footer}</div>
      </aside>

      {/* Barre supérieure (mobile) */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        {header}
        <button type="button" onClick={() => setOpen(true)} className="rounded-xl p-2 text-ink-soft hover:bg-surface" aria-label={t.common.menu} aria-expanded={open}>
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-[82%] max-w-xs flex-col bg-white shadow-card">
            <div className="flex items-center justify-between px-4 py-4">
              {header}
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-ink-soft hover:bg-surface" aria-label={t.common.close}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3">
              <Links items={items} rootHref={rootHref} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="border-t border-gray-100 p-3">{footer}</div>
          </div>
        </div>
      )}
    </>
  );
}
