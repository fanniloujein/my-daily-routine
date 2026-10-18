"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Dict, Locale } from "@/i18n";

export function AuthForm({ mode, locale, d, next }: { mode: "login" | "register"; locale: Locale; d: Dict; next?: string }) {
  const router = useRouter();
  const a = d.account;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (mode === "register" && password.length < 10) return setErr(a.weak);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { name, email, password, locale }),
      });
      if (res.ok) {
        // Seuls les chemins internes sont acceptés comme destination.
        const target = next && next.startsWith("/") && !next.startsWith("//") ? next : `/${locale}/espace`;
        router.push(target);
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setErr(
        res.status === 429 ? d.common.tooMany
        : data.error === "exists" ? a.exists
        : data.error === "weak_password" ? a.weak
        : mode === "login" ? a.invalid
        : d.common.error,
      );
    } catch {
      setErr(d.common.network);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mx-auto w-full max-w-md p-6 sm:p-8" noValidate>
      <h1 className="text-2xl">{mode === "login" ? a.loginTitle : a.registerTitle}</h1>
      <p className="mt-2 text-sm text-ink-2">{a.optionalNote}</p>
      <div className="mt-6 space-y-4">
        {mode === "register" && (
          <div>
            <label htmlFor="name" className="field-label">{d.configurator.name}</label>
            <input id="name" className="input" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div>
          <label htmlFor="email" className="field-label">{d.configurator.email}</label>
          <input id="email" type="email" dir="ltr" className="input" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="field-label">{a.password}</label>
          <input
            id="password"
            type="password"
            className="input"
            required
            minLength={mode === "register" ? 10 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            aria-describedby={mode === "register" ? "pw-help" : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "register" && <p id="pw-help" className="field-help">{a.passwordHelp}</p>}
        </div>
      </div>
      {err && <p className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger" role="alert">{err}</p>}
      <button type="submit" className="btn-dark mt-6 w-full" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {mode === "login" ? a.loginCta : a.registerCta}
      </button>
      <p className="mt-5 text-center text-sm text-ink-2">
        {mode === "login" ? a.noAccount : a.hasAccount}{" "}
        <Link href={`/${locale}/espace/${mode === "login" ? "inscription" : "connexion"}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink underline underline-offset-2">
          {mode === "login" ? a.registerCta : a.loginCta}
        </Link>
      </p>
    </form>
  );
}
