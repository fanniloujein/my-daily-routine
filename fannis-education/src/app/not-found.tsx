import { getI18n } from "@/lib/i18n/server";
import { LinkButton } from "@/components/ui";
import { Logo } from "@/components/Logo";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4 text-center">
      <Logo />
      <div>
        <p className="text-5xl font-bold text-brand-200">404</p>
        <h1 className="mt-2 text-xl font-semibold">{t.common.notFoundTitle}</h1>
        <p className="mt-1 text-ink-muted">{t.common.notFoundBody}</p>
      </div>
      <LinkButton href="/">{t.common.backHome}</LinkButton>
    </div>
  );
}
