"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import type { Dict } from "@/i18n";

export function QuoteActions({ reference, token, quoteId, d }: { reference: string; token: string | null; quoteId: string; d: Dict }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = d.tracking;

  const send = async (action: "accept" | "reject") => {
    if (action === "accept" && !window.confirm(t.acceptConfirm)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/requests/${reference}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token ?? undefined, quoteId, action, note: note || undefined }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setErr(d.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 border-t border-line pt-5">
      <p className="text-xs text-ink-muted">{t.acceptLegal}</p>
      {mode === "reject" ? (
        <div className="mt-4">
          <label htmlFor="reject-note" className="field-label">{t.rejectNote}</label>
          <textarea id="reject-note" className="input" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-danger" disabled={busy} onClick={() => send("reject")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
              {t.reject}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMode("idle")}>{d.common.cancel}</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => send("accept")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            {t.accept}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setMode("reject")}>{t.reject}</button>
        </div>
      )}
      {err && <p className="field-error" role="alert">{err}</p>}
    </div>
  );
}
