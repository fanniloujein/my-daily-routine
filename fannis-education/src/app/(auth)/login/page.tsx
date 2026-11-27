import Link from "next/link";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { homeForRole, safeRedirectPath } from "@/lib/auth/token";
import { Card } from "@/components/ui";
import { LoginForm } from "@/components/client/LoginForm";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.common.login };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeForRole(user.role));
  const { t } = await getI18n();
  const { next } = await searchParams;
  const showDemo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "true";
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold">{t.auth.loginTitle}</h1>
      <p className="mb-6 mt-1 text-ink-muted">{t.auth.loginSubtitle}</p>
      <LoginForm next={safeRedirectPath(next) ?? undefined} />
      <p className="mt-6 text-center text-sm text-ink-muted">
        {t.auth.noAccount}{" "}
        <Link href="/register" className="font-medium text-brand-700 hover:underline">{t.common.register}</Link>
      </p>
      {showDemo && (
        <div className="mt-6 rounded-xl bg-sun-50 p-4 text-xs text-ink-soft">
          <p className="font-semibold text-ink">{t.auth.demoAccounts}</p>
          <p className="mb-2">{t.auth.demoAccountsHint}</p>
          <ul className="space-y-0.5" dir="ltr">
            <li>eleve.demo@fannis-education.test · Demo!2026</li>
            <li>enseignant.demo@fannis-education.test · Demo!2026</li>
            <li>admin : SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD</li>
          </ul>
        </div>
      )}
    </Card>
  );
}
