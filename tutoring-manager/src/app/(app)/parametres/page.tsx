"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Database, Download, Plus, Settings, Trash2, Upload } from "lucide-react";
import { api, refreshAll, useApi } from "@/lib/client";
import { PAYMENT_METHODS } from "@/lib/constants";
import { weekdayName } from "@/lib/dates";
import type { Settings as S } from "@/lib/settings";
import { LOCALES, type Locale } from "@/i18n";
import { Button, Card, Checkbox, Field, Input, Loading, PageHeader, Segmented, Select, Switch, Tabs, useConfirm, useToast } from "@/components/ui";
import { useApp } from "@/components/providers";

type Me = { name: string; email: string; settings: S };
const TABS = [
  { value: "profil", label: "Profil" },
  { value: "cours", label: "Cours & tarifs" },
  { value: "horaires", label: "Horaires & disponibilités" },
  { value: "notifications", label: "Notifications" },
  { value: "apparence", label: "Apparence & langue" },
  { value: "securite", label: "Sécurité" },
  { value: "donnees", label: "Sauvegarde & données" },
] as const;

function SettingsInner() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>((sp.get("tab") as (typeof TABS)[number]["value"]) || "profil");
  const { data, mutate } = useApi<Me>("/api/me");
  const toast = useToast();
  const router = useRouter();
  const [v, setV] = useState<(S & { name: string; email: string }) | null>(null);
  useEffect(() => { if (data) setV({ ...data.settings, name: data.name, email: data.email }); }, [data]);
  if (!v) return <Loading rows={6} />;
  const save = async (patch: Partial<S & { name: string; email: string }> = v) => {
    try {
      await api("/api/settings", { method: "PATCH", body: patch });
      toast.success("Paramètres enregistrés.");
      await mutate();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV({ ...v, [k]: val });
  const n = v.notifications;
  const setN = (k: keyof S["notifications"], val: boolean | number) => setV({ ...v, notifications: { ...n, [k]: val } });

  return (
    <div>
      <PageHeader title="Paramètres" icon={<Settings className="h-5 w-5" />} />
      <Tabs tabs={TABS as unknown as { value: (typeof TABS)[number]["value"]; label: string }[]} value={tab} onChange={setTab} />
      {tab === "profil" && (
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom de l'application"><Input value={v.appName} onChange={(e) => set("appName", e.target.value)} /></Field>
            <Field label="Nom de l'enseignante (reçus)"><Input value={v.teacherName} onChange={(e) => set("teacherName", e.target.value)} /></Field>
            <Field label="Nom du compte"><Input value={v.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="E-mail de connexion"><Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Téléphone (reçus)"><Input value={v.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="E-mail de contact (reçus)"><Input value={v.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></Field>
            <Field label="Adresse (reçus)" className="sm:col-span-2"><Input value={v.address} onChange={(e) => set("address", e.target.value)} /></Field>
          </div>
          <Button className="mt-4" onClick={() => save()}>Enregistrer</Button>
        </Card>
      )}
      {tab === "cours" && (
        <Card>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tarif par défaut (DT)"><Input type="number" min={0} value={v.defaultRate} onChange={(e) => set("defaultRate", Number(e.target.value))} /></Field>
            <Field label="Durée par défaut (min)"><Input type="number" min={15} step={15} value={v.defaultDuration} onChange={(e) => set("defaultDuration", Number(e.target.value))} /></Field>
            <Field label="Lieu habituel"><Input value={v.defaultLocation} onChange={(e) => set("defaultLocation", e.target.value)} /></Field>
          </div>
          <div className="mt-4 space-y-3">
            <Checkbox checked={v.lateAbsenceBillableDefault} onChange={(b) => set("lateAbsenceBillableDefault", b)} label="Absence tardive facturable par défaut" hint="Modifiable séance par séance. Une séance annulée ou reportée n'est jamais facturée." />
            <div>
              <div className="label">Modes de paiement acceptés</div>
              <div className="flex flex-wrap gap-4">{Object.entries(PAYMENT_METHODS).map(([k, l]) => <Checkbox key={k} checked={v.enabledPaymentMethods.includes(k as "CASH")} onChange={(b) => set("enabledPaymentMethods", b ? [...v.enabledPaymentMethods, k as "CASH"] : v.enabledPaymentMethods.filter((x) => x !== k))} label={l} />)}</div>
            </div>
            <p className="text-sm text-muted">Devise : dinar tunisien (DT, 3 décimales) · Fuseau horaire : Africa/Tunis. Matières, tarifs habituels et niveaux : <Link href="/matieres" className="text-primary-strong hover:underline">Matières & niveaux</Link>.</p>
          </div>
          <Button className="mt-4" onClick={() => save()}>Enregistrer</Button>
        </Card>
      )}
      {tab === "horaires" && (
        <div className="space-y-5">
          <Card title="Horaires habituels">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Début de journée"><Input type="time" value={v.dayStart} onChange={(e) => set("dayStart", e.target.value)} /></Field>
              <Field label="Fin de journée"><Input type="time" value={v.dayEnd} onChange={(e) => set("dayEnd", e.target.value)} /></Field>
              <Field label="Heures de cours max / jour" hint="Seuil de surcharge"><Input type="number" min={1} max={16} value={v.maxDailyHours} onChange={(e) => set("maxDailyHours", Number(e.target.value))} /></Field>
              <Field label="Pause minimale entre cours (min)"><Input type="number" min={0} max={120} value={v.breakMinutes} onChange={(e) => set("breakMinutes", Number(e.target.value))} /></Field>
            </div>
            <Button className="mt-4" onClick={() => save()}>Enregistrer</Button>
          </Card>
          <AvailabilityEditor />
        </div>
      )}
      {tab === "notifications" && (
        <Card>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3"><span className="text-sm">Prévenir des cours dans les</span><Input type="number" min={1} max={48} className="w-20" value={n.upcomingHours} onChange={(e) => setN("upcomingHours", Number(e.target.value))} /><span className="text-sm">prochaines heures</span></div>
            <Switch checked={n.unprepared} onChange={(b) => setN("unprepared", b)} label="Séance non préparée (dans les 3 jours)" />
            <Switch checked={n.postponed} onChange={(b) => setN("postponed", b)} label="Séance reportée à reprogrammer" />
            <div className="flex flex-wrap items-center gap-3"><Switch checked={n.pendingPayment} onChange={(b) => setN("pendingPayment", b)} label="Paiement en attente depuis plus de" /><Input type="number" min={0} className="w-20" value={n.pendingPaymentDays} onChange={(e) => setN("pendingPaymentDays", Number(e.target.value))} /><span className="text-sm">jours</span></div>
            <Switch checked={n.lowCredit} onChange={(b) => setN("lowCredit", b)} label="Crédit presque épuisé / avance insuffisante" />
            <Switch checked={n.packageRenewal} onChange={(b) => setN("packageRenewal", b)} label="Forfait mensuel à renouveler" />
            <Switch checked={n.urgentTasks} onChange={(b) => setN("urgentTasks", b)} label="Tâches urgentes ou en retard" />
            <div className="flex flex-wrap items-center gap-3"><Switch checked={n.deadlines} onChange={(b) => setN("deadlines", b)} label="Échéances (tâches, devoirs) dans les" /><Input type="number" min={0} max={30} className="w-20" value={n.deadlineDays} onChange={(e) => setN("deadlineDays", Number(e.target.value))} /><span className="text-sm">jours</span></div>
          </div>
          <Button className="mt-5" onClick={() => save({ notifications: v.notifications })}>Enregistrer</Button>
        </Card>
      )}
      {tab === "apparence" && <Appearance onSave={(p) => save(p)} />}
      {tab === "securite" && <PasswordForm />}
      {tab === "donnees" && <DataPanel />}
    </div>
  );
}

function Appearance({ onSave }: { onSave: (p: Partial<S>) => void }) {
  const { theme, setTheme, locale, setLocale } = useApp();
  return (
    <Card>
      <div className="space-y-5">
        <Field label="Thème"><Segmented value={theme} onChange={(t) => { setTheme(t); onSave({ theme: t }); }} options={[{ value: "light", label: "Clair" }, { value: "dark", label: "Sombre" }, { value: "system", label: "Automatique" }]} /></Field>
        <Field label="Langue" hint="Le français est la langue principale. L'anglais et l'arabe (de droite à gauche) sont préparés : la navigation est traduite, les pages le seront progressivement.">
          <Select className="max-w-xs" value={locale} onChange={(e) => { setLocale(e.target.value as Locale); onSave({ locale: e.target.value as Locale }); }} options={Object.entries(LOCALES).map(([k, l]) => ({ value: k, label: l.label }))} />
        </Field>
      </div>
    </Card>
  );
}

function AvailabilityEditor() {
  const toast = useToast();
  const { data, mutate } = useApi<{ weekday: number; startTime: string; endTime: string }[]>("/api/availability");
  const [slots, setSlots] = useState<{ weekday: number; startTime: string; endTime: string }[]>([]);
  useEffect(() => { if (data) setSlots(data.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }))); }, [data]);
  const save = async () => {
    try {
      await api("/api/availability", { method: "PUT", body: { slots } });
      toast.success("Disponibilités enregistrées.");
      mutate();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  };
  return (
    <Card title="Mes disponibilités hebdomadaires" action={<Button size="sm" variant="soft" onClick={() => setSlots([...slots, { weekday: 1, startTime: "14:00", endTime: "18:00" }])}><Plus className="h-4 w-4" />Créneau</Button>}>
      <p className="mb-3 text-sm text-muted">Affichées en vert dans le calendrier pour programmer vos cours sur les bons créneaux.</p>
      <div className="space-y-2">
        {slots.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Select className="w-36" value={String(s.weekday)} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, weekday: Number(e.target.value) } : x)))} options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: weekdayName(d) }))} />
            <Input type="time" className="w-28" value={s.startTime} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)))} />
            <span className="text-muted">→</span>
            <Input type="time" className="w-28" value={s.endTime} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, endTime: e.target.value } : x)))} />
            <Button size="icon-sm" variant="danger-ghost" onClick={() => setSlots(slots.filter((_, j) => j !== i))} aria-label="Retirer"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {slots.length === 0 && <p className="text-sm text-muted">Aucune disponibilité définie.</p>}
      </div>
      <Button className="mt-4" onClick={save}>Enregistrer les disponibilités</Button>
    </Card>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setErr(null);
    try {
      await api("/api/auth/password", { body: v });
      toast.success("Mot de passe modifié. Les autres sessions ont été déconnectées.");
      setV({ current: "", next: "", confirm: "" });
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
  };
  return (
    <Card title="Modifier le mot de passe">
      <div className="grid max-w-md gap-3">
        <Field label="Mot de passe actuel"><Input type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} /></Field>
        <Field label="Nouveau mot de passe" hint="10 caractères minimum, au moins une lettre et un chiffre."><Input type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} /></Field>
        <Field label="Confirmer"><Input type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} /></Field>
        {err && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
        <Button onClick={save} disabled={!v.current || !v.next}>Modifier</Button>
      </div>
      <p className="mt-4 text-xs text-muted">Session sécurisée : cookie HttpOnly signé, expiration après 14 jours, limitation des tentatives de connexion. Changer le mot de passe déconnecte tous les autres appareils.</p>
    </Card>
  );
}

function DataPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const restore = async (file: File) => {
    const ok = await confirm({ title: "Restaurer cette sauvegarde ?", text: "Toutes les données actuelles (élèves, séances, finances, pédagogie, tâches) seront REMPLACÉES par celles du fichier. Téléchargez d'abord une sauvegarde actuelle par précaution.", danger: true, confirm: "Remplacer mes données" });
    if (ok === false) return;
    setBusy(true);
    try {
      const backup = JSON.parse(await file.text());
      const r = await api<{ restored: Record<string, number> }>("/api/backup", { body: { confirm: "RESTAURER", backup } });
      toast.success(`Restauration terminée : ${r.restored.student ?? 0} élève(s), ${r.restored.session ?? 0} séance(s).`);
      refreshAll();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fichier invalide"); } finally { setBusy(false); }
  };
  const demo = async (add: boolean) => {
    if (!add && (await confirm({ title: "Supprimer les données de démonstration ?", text: "Seules les données fictives marquées « démo » sont supprimées. Vos vraies données ne sont pas touchées.", danger: true })) === false) return;
    setBusy(true);
    try {
      await api("/api/demo", { method: add ? "POST" : "DELETE" });
      toast.success(add ? "Données de démonstration ajoutées." : "Données de démonstration supprimées.");
      refreshAll();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Sauvegarde et restauration" icon={<Database className="h-4 w-4" />}>
        <p className="mb-4 text-sm text-muted">La sauvegarde contient toutes vos données (y compris les documents et le journal financier) dans un fichier JSON. Conservez-la en lieu sûr.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/backup"><Button><Download className="h-4 w-4" />Télécharger une sauvegarde</Button></a>
          <label><input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} /><span className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium ${busy ? "opacity-50" : ""}`}><Upload className="h-4 w-4" />Restaurer…</span></label>
        </div>
      </Card>
      <Card title="Données de démonstration">
        <p className="mb-4 text-sm text-muted">Élèves, séances et paiements fictifs pour découvrir l&apos;application. Ils sont marqués « démo » et supprimables à tout moment.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy} onClick={() => demo(true)}>Ajouter la démo</Button>
          <Button variant="danger-ghost" loading={busy} onClick={() => demo(false)}><Trash2 className="h-4 w-4" />Supprimer la démo</Button>
        </div>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return <Suspense><SettingsInner /></Suspense>;
}
