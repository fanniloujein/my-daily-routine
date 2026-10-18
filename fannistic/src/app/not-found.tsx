import Link from "next/link";
import { headers } from "next/headers";
import { getDict, isLocale } from "@/i18n";
import { LogoMark } from "@/components/site/Logo";

export default async function NotFound() {
  const raw = (await headers()).get("x-locale");
  const locale = isLocale(raw) ? raw : "fr";
  const d = getDict(locale);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <LogoMark className="h-14 w-14" />
      <h1 className="mt-6 text-3xl">{d.notFound.title}</h1>
      <p className="mt-3 text-ink-2">{d.notFound.text}</p>
      <Link href={`/${locale}`} className="btn-dark mt-8">{d.notFound.home}</Link>
    </div>
  );
}
