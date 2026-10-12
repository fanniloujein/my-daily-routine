"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Notice, Toggle } from "@/components/ui";
import { api } from "@/lib/client";
import { AuthFrame } from "@/components/AuthFrame";

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    api<{ signupAllowed: boolean; authenticated: boolean }>("/api/auth/status").then((s) => {
      if (s.authenticated) router.replace("/");
      setBlocked(!s.signupAllowed);
    }).catch(() => setError("L'application n'arrive pas à joindre sa base de données. Ouvre /api/health pour voir ce qu'il faut corriger."));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) return setError("Le mot de passe doit contenir au moins 10 caractères.");
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/setup", { body: { name, email, password, demo } });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title="Bienvenue ✨" subtitle="Créons ton espace personnel. Tout pourra être modifié ensuite.">
      {blocked ? (
        <Notice tone="warning">Un compte existe déjà sur cette installation. <a className="underline" href="/login">Se connecter</a></Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label="Prénom">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="given-name" />
          </Field>
          <Field label="E-mail">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          <Field label="Mot de passe" hint="10 caractères minimum">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
          </Field>
          <Toggle checked={demo} onChange={setDemo} label="Ajouter des données de démonstration" description="Pour découvrir l'application avec des exemples. Laisse décoché pour commencer avec une application vide." />
          <Button className="w-full" size="lg" loading={loading}>
            Créer mon espace
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}
