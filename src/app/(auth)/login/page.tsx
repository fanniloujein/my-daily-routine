"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Field, Notice } from "@/components/ui";
import { AuthFrame } from "@/components/AuthFrame";
import { api } from "@/lib/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [noUser, setNoUser] = useState(false);
  const [down, setDown] = useState(false);

  useEffect(() => {
    api<{ hasUser: boolean; authenticated: boolean }>("/api/auth/status").then((s) => {
      if (s.authenticated) router.replace("/");
      else if (!s.hasUser) router.replace("/setup");
      setNoUser(!s.hasUser);
    }).catch(() => setDown(true));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { email, password } });
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Notice tone="danger">{error}</Notice>}
      {down && (
        <Notice tone="danger">
          L&apos;application n&apos;arrive pas à joindre sa base de données. Ouvre{" "}
          <a className="underline" href="/api/health">
            /api/health
          </a>{" "}
          pour voir ce qu&apos;il faut corriger.
        </Notice>
      )}
      {noUser && <Notice>Aucun compte pour l&apos;instant. <Link className="underline" href="/setup">Créer mon espace</Link></Notice>}
      <Field label="E-mail">
        <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Mot de passe">
        <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Button className="w-full" size="lg" loading={loading}>
        Se connecter
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthFrame title="Bon retour 🌙" subtitle="Connecte-toi à ton espace personnel.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
