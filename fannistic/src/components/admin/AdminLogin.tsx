"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/site/Logo";

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-pop"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, admin: true }),
        }).catch(() => null);
        setBusy(false);
        if (res?.ok) {
          router.push("/admin");
          router.refresh();
        } else setErr(res?.status === 429 ? "Trop de tentatives, réessayez dans quelques minutes." : "Identifiants incorrects.");
      }}
    >
      <Logo />
      <h1 className="mt-6 text-xl">Administration</h1>
      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="a-email" className="field-label">E-mail</label>
          <input id="a-email" type="email" className="input" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="a-pw" className="field-label">Mot de passe</label>
          <input id="a-pw" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      {err && <p className="mt-4 text-sm font-medium text-danger" role="alert">{err}</p>}
      <button type="submit" className="btn-dark mt-6 w-full" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Se connecter
      </button>
    </form>
  );
}
