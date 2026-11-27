"use client";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">{t.common.errorTitle}</h1>
      <p className="max-w-md text-ink-muted">{t.common.errorBody}</p>
      <Button onClick={reset}>{t.common.retry}</Button>
    </div>
  );
}
