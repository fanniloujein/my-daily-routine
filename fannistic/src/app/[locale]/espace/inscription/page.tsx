import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/account/AuthForm";
import { isLocale, type Locale } from "@/i18n";
import { getSiteDict } from "@/server/site";
import { getSessionUser } from "@/server/auth";

export const metadata: Metadata = { robots: { index: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale: raw } = await params;
  const { next } = await searchParams;
  const locale = (isLocale(raw) ? raw : "fr") as Locale;
  if (await getSessionUser()) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : `/${locale}/espace`);
  const d = await getSiteDict(locale);
  return (
    <div className="bg-paper-2/60 px-4 py-14 sm:py-20">
      <AuthForm mode="register" locale={locale} d={d} next={next} />
    </div>
  );
}
