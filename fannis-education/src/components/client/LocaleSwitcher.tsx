"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/actions/locale";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/components/ui/cn";

export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = locale === "fr" ? "ar" : "fr";
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={t.common.language}
      onClick={() =>
        start(async () => {
          await setLocaleAction(next);
          router.refresh();
        })
      }
      className={cn("inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-ink-soft hover:bg-surface", className)}
    >
      <Languages className="h-4 w-4" aria-hidden />
      <span lang={next}>{next === "ar" ? "العربية" : "Français"}</span>
    </button>
  );
}
