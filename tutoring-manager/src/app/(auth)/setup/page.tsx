"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, Checkbox, Field, Input } from "@/components/ui";

export default function SetupPage() {
  const router = useRouter();
  const [v, setV] = useState({ name: "Fanni", email: "", password: "", confirm: "", demo: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    api<{ needsSetup: boolean }>("/api/auth/setup").then((r) => !r.needsSetup && router.replace("/login")).catch(() => {});
  }, [router]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (v.password !== v.confirm) return setError("Les deux mots de passe ne correspondent pas.");
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/setup", { body: { name: v.name, email: v.email, password: v.password, demo: v.demo } });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
      setLoading(false);
    }
  };
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Créer le compte administratrice</h2>
        <p className="mt-1 text-sm text-muted">Un seul compte peut être créé. Il protège toutes les données des élèves et les finances.</p>
      </div>
      <Field label="Votre nom" required><Input required value={v.name} onChange={set("name")} /></Field>
      <Field label="E-mail de connexion" required><Input type="email" required autoComplete="email" value={v.email} onChange={set("email")} /></Field>
      <Field label="Mot de passe" required hint="10 caractères minimum, avec au moins une lettre et un chiffre."><Input type="password" required minLength={10} autoComplete="new-password" value={v.password} onChange={set("password")} /></Field>
      <Field label="Confirmer le mot de passe" required><Input type="password" required autoComplete="new-password" value={v.confirm} onChange={set("confirm")} /></Field>
      <Checkbox checked={v.demo} onChange={(demo) => setV({ ...v, demo })} label="Ajouter des données de démonstration fictives" hint="Pour découvrir l'application. Supprimables en un clic dans Paramètres." />
      {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" size="lg" loading={loading}>Créer mon espace</Button>
    </form>
  );
}
