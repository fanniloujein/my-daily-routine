"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarSync, Copy, Database, Download, KeyRound, Languages, Shield, Sparkles, SunMoon, Upload, User } from "lucide-react";
import { Button, Card, Field, Loading, Notice, PageHeader, Toggle, useUi } from "@/components/ui";
import { ReminderStatus } from "@/components/ReminderStatus";
import { api, refreshAll, useApi } from "@/lib/client";
import { useMe } from "@/lib/hooks";
import { LOCALES } from "@/i18n";
import { CURRENCIES } from "@/lib/billing";
import type { UserSettings } from "@/lib/validation";

export default function SettingsPage() {
  const { data: me, mutate } = useMe();
  const { toast, confirm } = useUi();
  const [name, setName] = useState("");
  const [s, setS] = useState<UserSettings | null>(null);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [health, setHealth] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const token = useApi<{ token: string | null }>("/api/ics/token");
  const demo = useApi<{ hasDemo: boolean }>("/api/demo");
  const [origin, setOrigin] = useState("");
  const [wipe, setWipe] = useState("");

  useEffect(() => {
    if (me) {
      setName(me.name);
      setS(me.settings);
    }
  }, [me]);
  useEffect(() => setOrigin(window.location.origin), []);

  if (!me || !s) return <Loading />;

  async function saveSettings(patch: Partial<UserSettings>, msg = "Paramètres enregistrés") {
    const next = { ...s!, ...patch };
    setS(next);
    try {
      await api("/api/me", { method: "PATCH", body: { settings: { ...next, lunchStart: next.lunchStart || null, lunchEnd: next.lunchEnd || null } } });
      await mutate();
      await refreshAll();
      toast(msg);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }

  const feedUrl = token.data?.token ? `${origin}/api/ics/feed/${token.data.token}.ics` : null;

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Ton rythme, ta confidentialité, tes données." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Profil" icon={<User className="h-4 w-4" />}>
          <div className="space-y-3">
            <Field label="Prénom">
              <div className="flex gap-2">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await api("/api/me", { method: "PATCH", body: { name } });
                    mutate();
                    toast("Prénom mis à jour");
                  }}
                >
                  OK
                </Button>
              </div>
            </Field>
            <p className="text-xs text-muted">{me.email}</p>
            <Field label="Langue" hint="Le français est complet ; l'architecture est prête pour l'anglais, l'allemand et l'arabe (droite à gauche).">
              <select className="input" value={me.locale} onChange={async (e) => { await api("/api/me", { method: "PATCH", body: { locale: e.target.value } }); mutate(); }}>
                {Object.entries(LOCALES).map(([k, v]) => (
                  <option key={k} value={k} disabled={!v.available}>
                    {v.label} {v.available ? "" : "(bientôt)"}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        <Card title="Mon rythme" icon={<SunMoon className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Début de journée">
              <input type="time" className="input" value={s.dayStart} onChange={(e) => setS({ ...s, dayStart: e.target.value })} />
            </Field>
            <Field label="Fin du travail" hint="Pas de tâche planifiée après">
              <input type="time" className="input" value={s.workEnd} onChange={(e) => setS({ ...s, workEnd: e.target.value })} />
            </Field>
            <Field label="Fin de journée">
              <input type="time" className="input" value={s.dayEnd} onChange={(e) => setS({ ...s, dayEnd: e.target.value })} />
            </Field>
            <Field label="Pause entre tâches (min)">
              <input type="number" min={0} max={60} className="input" value={s.breakMin} onChange={(e) => setS({ ...s, breakMin: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Déjeuner — début">
              <input type="time" className="input" value={s.lunchStart ?? ""} onChange={(e) => setS({ ...s, lunchStart: e.target.value })} />
            </Field>
            <Field label="Déjeuner — fin">
              <input type="time" className="input" value={s.lunchEnd ?? ""} onChange={(e) => setS({ ...s, lunchEnd: e.target.value })} />
            </Field>
            <Field label="Devise (paiements et revenus)" className="col-span-2">
              <select className="input" value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })}>
                {Object.entries(CURRENCIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Objectif allemand (min / semaine)" className="col-span-2">
              <input type="number" min={0} step={15} className="input" value={s.germanWeeklyMinutes} onChange={(e) => setS({ ...s, germanWeeklyMinutes: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={() => saveSettings({})}>Enregistrer</Button>
          </div>
        </Card>

        <div id="rappels" className="space-y-5">
          <ReminderStatus />
          <Card title="Rappels fiables via ton agenda (.ics)" icon={<CalendarSync className="h-4 w-4" />}>
            <div className="space-y-3 text-sm text-ink-2">
              <p>
                Abonne l&apos;agenda de ton téléphone (Google Agenda, Calendrier Apple, Outlook) à My Life OS : tes activités et prises de médicaments arriveront avec leurs alarmes, même
                application fermée.
              </p>
              {feedUrl ? (
                <>
                  <div className="flex gap-2">
                    <input className="input font-mono text-xs" readOnly value={feedUrl} onFocus={(e) => e.target.select()} />
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard?.writeText(feedUrl);
                        toast("Lien copié");
                      }}
                      aria-label="Copier le lien"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Notice tone="warning">Ce lien est secret : toute personne qui le possède peut lire ton agenda. Régénère-le ou révoque-le en cas de doute.</Notice>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={async () => { await api("/api/ics/token", { method: "POST" }); token.mutate(); toast("Nouveau lien généré"); }}>
                      Régénérer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={async () => {
                        if (!(await confirm({ title: "Révoquer le lien ?", message: "Les agendas abonnés ne recevront plus de mises à jour.", danger: true, confirmLabel: "Révoquer" }))) return;
                        await api("/api/ics/token", { method: "DELETE" });
                        token.mutate();
                      }}
                    >
                      Révoquer
                    </Button>
                  </div>
                </>
              ) : (
                <Button size="sm" onClick={async () => { await api("/api/ics/token", { method: "POST" }); token.mutate(); }}>
                  Créer mon lien d&apos;abonnement
                </Button>
              )}
              <a href="/api/ics" className="inline-flex items-center gap-1 text-xs font-medium text-primary-strong underline">
                <Download className="h-3.5 w-3.5" /> Ou télécharger un fichier .ics ponctuel
              </a>
              <p className="text-xs text-muted">Les agendas actualisent les abonnements toutes les quelques heures (selon l&apos;application) : pour un changement de dernière minute, garde l&apos;app ouverte.</p>
            </div>
          </Card>
        </div>

        <Card title="Confidentialité" icon={<Shield className="h-4 w-4" />}>
          <div className="space-y-3">
            <Toggle checked={s.privacyMode} onChange={(v) => saveSettings({ privacyMode: v })} label="Masquer les noms de médicaments" description="Tableau de bord, notifications : « Rappel santé » au lieu du nom" />
            <Toggle checked={s.icsHideMedNames} onChange={(v) => saveSettings({ icsHideMedNames: v })} label="Masquer les médicaments dans l'agenda abonné" description="Recommandé si ton agenda est partagé" />
            <p className="text-xs text-muted">Les noms, posologies et consignes de santé sont chiffrés en base (AES-256-GCM). Les sessions sont protégées par cookie sécurisé HttpOnly.</p>
          </div>
        </Card>

        <Card title="Mes données" icon={<Database className="h-4 w-4" />}>
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <Toggle checked={health} onChange={setHealth} label="Inclure les données de santé dans l'export" description="Le fichier contiendra les noms des médicaments en clair : garde-le en lieu sûr" />
              <a href={`/api/export${health ? "?health=1" : ""}`} className="inline-flex">
                <Button size="sm" variant="secondary">
                  <Download className="h-4 w-4" /> Exporter / sauvegarder (JSON)
                </Button>
              </a>
            </div>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (!(await confirm({ title: "Restaurer cette sauvegarde ?", message: "Toutes tes données actuelles seront remplacées par celles du fichier. Pense à exporter d'abord.", danger: true, confirmLabel: "Restaurer" }))) return;
                  try {
                    await api("/api/import", { raw: await file.text() });
                    await refreshAll();
                    toast("Sauvegarde restaurée");
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Import impossible", "danger");
                  }
                }}
              />
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Restaurer une sauvegarde
              </Button>
            </div>
            <div className="space-y-2 rounded-2xl border border-danger/30 bg-danger-soft/30 p-3">
              <p className="font-medium text-ink">Tout vider pour tout remplir moi-même</p>
              <p className="text-xs text-ink-2">
                Supprime tout le contenu : activités, élèves, séances, projets, allemand, médicaments, sport, loisirs, énergie et bilans. Ton compte, tes catégories et tes réglages sont conservés.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input className="input h-9 w-40" placeholder="Tape VIDER" value={wipe} onChange={(e) => setWipe(e.target.value)} aria-label="Confirmation" />
                <Button
                  size="sm"
                  variant="danger"
                  disabled={wipe.trim().toUpperCase() !== "VIDER"}
                  onClick={async () => {
                    if (!(await confirm({ title: "Tout vider ?", message: "Tout le contenu sera supprimé définitivement. Pense à exporter une sauvegarde avant si besoin.", danger: true, confirmLabel: "Tout vider" }))) return;
                    try {
                      await api("/api/reset", { body: { confirm: wipe } });
                      setWipe("");
                      await refreshAll();
                      toast("Application vidée : à toi de jouer ✨");
                    } catch (e) {
                      toast(e instanceof Error ? e.message : "Erreur", "danger");
                    }
                  }}
                >
                  Tout vider
                </Button>
              </div>
            </div>
            <div className="space-y-2 border-t border-line/60 pt-3">
              <p className="font-medium text-ink">Repartir de zéro dans le planning</p>
              <p className="text-xs text-muted">Supprime des activités sans toucher à tes élèves, projets, cartes d&apos;allemand, médicaments ni catégories. Pense à exporter avant.</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["done", "Activités terminées et passées", "Les activités terminées ou dont la date est passée seront supprimées."],
                    ["future", "Activités à venir", "Toutes les activités à partir d'aujourd'hui, y compris les activités récurrentes, seront supprimées."],
                    ["all", "Toutes les activités", "Tout ton planning sera vidé. Tes élèves, projets, cartes, médicaments et catégories sont conservés."],
                  ] as const
                ).map(([scope, label, msg]) => (
                  <Button
                    key={scope}
                    size="sm"
                    variant={scope === "all" ? "danger" : "secondary"}
                    onClick={async () => {
                      if (!(await confirm({ title: `Supprimer : ${label.toLowerCase()} ?`, message: `${msg} Cette action est définitive.`, danger: true, confirmLabel: "Supprimer" }))) return;
                      try {
                        const r = await api<{ count: number }>("/api/activities/clear", { body: { scope } });
                        await refreshAll();
                        toast(`${r.count} activité(s) supprimée(s)`);
                      } catch (e) {
                        toast(e instanceof Error ? e.message : "Erreur", "danger");
                      }
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2 border-t border-line/60 pt-3">
              <p className="text-ink-2">Données de démonstration : {demo.data?.hasDemo ? "présentes" : "absentes"}.</p>
              <div className="flex flex-wrap gap-2">
                {demo.data?.hasDemo ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      if (!(await confirm({ title: "Supprimer les données de démonstration ?", message: "Seules les données marquées « démo » sont supprimées. Tes propres données restent intactes.", danger: true, confirmLabel: "Supprimer" }))) return;
                      await api("/api/demo", { method: "DELETE" });
                      await refreshAll();
                      toast("Données de démonstration supprimées");
                    }}
                  >
                    Supprimer les données de démo
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={async () => { await api("/api/demo", { method: "POST" }); await refreshAll(); toast("Données de démonstration ajoutées"); }}>
                    Ajouter des données de démo
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Assistant IA" icon={<Sparkles className="h-4 w-4" />}>
          {me.aiEnabled ? (
            <Notice tone="success">Claude est connecté. Si le service est indisponible, l&apos;assistant bascule automatiquement sur son analyseur local.</Notice>
          ) : (
            <Notice>
              Mode local actif : l&apos;assistant comprend les phrases courantes sans service externe. Pour une compréhension plus riche, ajoute <code className="font-mono">ANTHROPIC_API_KEY</code> dans
              la configuration du serveur (voir README).
            </Notice>
          )}
        </Card>

        <Card title="Sécurité" icon={<KeyRound className="h-4 w-4" />}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/api/auth/password", { body: pw });
                setPw({ current: "", next: "" });
                toast("Mot de passe modifié");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Erreur", "danger");
              }
            }}
          >
            <Field label="Mot de passe actuel">
              <input type="password" className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
            </Field>
            <Field label="Nouveau mot de passe" hint="10 caractères minimum">
              <input type="password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
            </Field>
            <Button size="sm" disabled={!pw.current || pw.next.length < 10}>
              Changer le mot de passe
            </Button>
          </form>
        </Card>
        <Card title="Langues" icon={<Languages className="h-4 w-4" />}>
          <p className="text-sm text-ink-2">Pour ajouter une langue : créer un dictionnaire dans <code className="font-mono text-xs">src/i18n</code> puis l&apos;activer dans <code className="font-mono text-xs">src/i18n/index.ts</code>.</p>
        </Card>
      </div>
    </div>
  );
}
