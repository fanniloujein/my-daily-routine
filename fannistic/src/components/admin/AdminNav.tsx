"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, FileQuestion, Images, Inbox, LayoutDashboard, LogOut, Menu, Settings, Tags, Type, Wallet, X } from "lucide-react";
import { Logo } from "@/components/site/Logo";

const LINKS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/demandes", label: "Demandes", icon: Inbox },
  { href: "/admin/services", label: "Services & filtres", icon: Tags },
  { href: "/admin/tarifs", label: "Tarifs", icon: Wallet },
  { href: "/admin/portfolio", label: "Réalisations", icon: Images },
  { href: "/admin/faq", label: "FAQ", icon: FileQuestion },
  { href: "/admin/contenu", label: "Textes du site", icon: Type },
  { href: "/admin/reglages", label: "Réglages", icon: Settings },
];

export function AdminNav({ name, newCount }: { name: string; newCount: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav aria-label="Administration" className="flex flex-1 flex-col gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={active(href) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            active(href) ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1">{label}</span>
          {href === "/admin/demandes" && newCount > 0 && (
            <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-midnight" aria-label={`${newCount} nouvelles`}>{newCount}</span>
          )}
        </Link>
      ))}
      <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
        <p className="px-3 pb-2 text-xs text-white/50">{name}</p>
        <Link href="/fr" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/65 hover:text-white">
          <ExternalLink className="h-4 w-4" aria-hidden="true" /> Voir le site
        </Link>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/admin/connexion");
            router.refresh();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/65 hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" /> Déconnexion
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between bg-midnight px-4 py-3 lg:hidden">
        <Logo tone="light" />
        <button type="button" className="rounded-lg p-2 text-white" aria-expanded={open} aria-label={open ? "Fermer le menu" : "Menu"} onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && <div className="flex min-h-[calc(100vh-56px)] flex-col bg-midnight px-4 pb-6 lg:hidden">{nav}</div>}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-midnight px-4 py-6 lg:flex">
        <div className="mb-8 px-2">
          <Logo tone="light" />
        </div>
        {nav}
      </aside>
    </>
  );
}
