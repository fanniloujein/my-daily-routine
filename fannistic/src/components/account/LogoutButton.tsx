"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton({ label, redirectTo }: { label: string; redirectTo: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-ghost btn-sm"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        router.push(redirectTo);
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" /> {label}
    </button>
  );
}
